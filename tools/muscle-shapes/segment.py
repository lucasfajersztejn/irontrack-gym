"""Segmenta cada musculo del render anatomico y exporta trazados SVG.

Idea: el dibujo ya separa los musculos con pliegues oscuros. Creciendo una
region desde el centro de cada musculo y aceptando solo pixeles claros, el
relleno se detiene SOLO en esos pliegues y toma la forma real del musculo.
La elipse que antes se pintaba encima pasa a ser solo el limite maximo de
crecimiento, para que un relleno que se escape por un hueco del contorno no
se coma media pierna.

Pillow puro (sin numpy: el entorno no permite instalar paquetes). Se trabaja
a media resolucion para que el BFS en Python sea rapido; los trazados se
escalan despues al viewBox de 680x1200.
"""
import json
import sys
from collections import deque
from PIL import Image, ImageFilter

SCALE = 2  # el fuente es 680x1200; segmentamos a 340x600
VIEW_W, VIEW_H = 680, 1200


def load(path):
    im = Image.open(path).convert("LA").resize(
        (VIEW_W // SCALE, VIEW_H // SCALE), Image.LANCZOS
    )
    gray = im.getchannel(0).filter(ImageFilter.MedianFilter(3))
    return gray.load(), im.getchannel(1).load(), im.size


def grow(gray, alpha, size, seeds, bound, tol, floor):
    """BFS desde los centros, limitado a la elipse `bound` y a pixeles claros."""
    w, h = size
    cx, cy, rx, ry = bound
    seen = set()
    out = set()
    q = deque()
    ref = 0
    for sx, sy in seeds:
        sx, sy = int(sx), int(sy)
        if 0 <= sx < w and 0 <= sy < h:
            ref = max(ref, gray[sx, sy])
            q.append((sx, sy))
            seen.add((sx, sy))
    lo = max(floor, ref - tol)
    while q:
        x, y = q.popleft()
        if alpha[x, y] < 140 or gray[x, y] < lo:
            continue
        # Dentro de la elipse de crecimiento maximo
        dx = (x - cx) / rx
        dy = (y - cy) / ry
        if dx * dx + dy * dy > 1:
            continue
        out.add((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    return out


def seed_grid(cx, cy, rx, ry):
    """Varias semillas por region.

    Con una sola, un musculo dibujado por bloques (el recto abdominal) se
    rellenaria solo el bloque de la semilla: el pliegue INTERNO entre bloques
    frena el crecimiento igual que el externo. Sembrando en varios puntos se
    cubren todos los bloques y el cierre morfologico los une despues.
    """
    pts = [(cx, cy)]
    for f in (0.45, 0.78):
        pts += [
            (cx + rx * f, cy), (cx - rx * f, cy),
            (cx, cy + ry * f), (cx, cy - ry * f),
        ]
    return pts


def to_mask(pixels, size, close):
    m = Image.new("L", size, 0)
    px = m.load()
    for x, y in pixels:
        px[x, y] = 255
    # Cierre morfologico: une los bloques vecinos y tapa las estriaciones
    # internas, sin desbordar el contorno exterior del musculo.
    return m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))


def trace(mask):
    """Contorno exterior por seguimiento de borde (Moore), el mayor componente."""
    w, h = mask.size
    px = mask.load()
    start = None
    for y in range(h):
        for x in range(w):
            if px[x, y] > 127:
                start = (x, y)
                break
        if start:
            break
    if not start:
        return []
    nb = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    contour = [start]
    cur = start
    d = 0
    for _ in range(20000):
        found = False
        for k in range(8):
            i = (d + 6 + k) % 8
            nx, ny = cur[0] + nb[i][0], cur[1] + nb[i][1]
            if 0 <= nx < w and 0 <= ny < h and px[nx, ny] > 127:
                cur = (nx, ny)
                d = i
                contour.append(cur)
                found = True
                break
        if not found or (len(contour) > 3 and cur == start):
            break
    return contour


def rdp(pts, eps):
    """Ramer-Douglas-Peucker: quita vertices que no cambian la silueta."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** 0.5 or 1e-9
    worst, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        dist = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / n
        if dist > worst:
            worst, idx = dist, i
    if worst <= eps:
        return [a, b]
    return rdp(pts[: idx + 1], eps)[:-1] + rdp(pts[idx:], eps)


def rdp_closed(pts, eps):
    """RDP sobre un contorno CERRADO.

    Aplicado tal cual, el primer y el ultimo punto de un contorno cerrado son
    el mismo: la recta base es degenerada, todas las distancias salen 0 y la
    simplificacion devuelve dos puntos. Se parte el anillo por el vertice mas
    lejano al inicio y se simplifica cada arco por separado.
    """
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    if len(pts) < 4:
        return pts
    a = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - a[0]) ** 2 + (pts[i][1] - a[1]) ** 2)
    first = rdp(pts[: far + 1], eps)
    second = rdp(pts[far:] + [a], eps)
    return first[:-1] + second[:-1]


def smooth_path(pts):
    """Polilinea cerrada -> path SVG con curvas por puntos medios."""
    if len(pts) < 3:
        return ""
    p = [(x * SCALE, y * SCALE) for x, y in pts]
    mid = lambda a, b: ((a[0] + b[0]) / 2, (b[1] + a[1]) / 2)
    d = []
    m0 = mid(p[-1], p[0])
    d.append(f"M{m0[0]:.1f},{m0[1]:.1f}")
    for i in range(len(p)):
        c = p[i]
        m = mid(c, p[(i + 1) % len(p)])
        d.append(f"Q{c[0]:.1f},{c[1]:.1f} {m[0]:.1f},{m[1]:.1f}")
    d.append("Z")
    return "".join(d)


def main():
    out_dir, spec_path = sys.argv[1], sys.argv[2]
    spec = json.load(open(spec_path, encoding="utf-8"))
    result = {}
    debug = {}
    for view in ("front", "back"):
        gray, alpha, size = load(f"{out_dir}/body-{view}.webp")
        result[view] = {}
        debug[view] = {}
        for muscle, cfg in spec[view].items():
            paths = []
            masks = []
            for part in cfg["parts"]:
                cx, cy, rx, ry = [v / SCALE for v in part]
                g = cfg.get("grow", 1.45)
                pix = grow(
                    gray, alpha, size,
                    seed_grid(cx, cy, rx * 0.9, ry * 0.9),
                    (cx, cy, rx * g, ry * g),
                    cfg.get("tol", 60),
                    cfg.get("floor", 70),
                )
                if len(pix) < 20:
                    continue
                m = to_mask(pix, size, cfg.get("close", 5))
                masks.append(m)
                c = trace(m)
                if len(c) > 8:
                    simple = rdp_closed(c, cfg.get("eps", 1.6))
                    if len(simple) > 3:
                        paths.append(smooth_path(simple))
            if paths:
                result[view][muscle] = paths
                debug[view][muscle] = sum(
                    sum(1 for v in m.getdata() if v > 127) for m in masks
                )
    json.dump(result, open(f"{out_dir}/paths.json", "w", encoding="utf-8"))
    for v in debug:
        print(v, {k: val for k, val in sorted(debug[v].items())})


if __name__ == "__main__":
    main()
