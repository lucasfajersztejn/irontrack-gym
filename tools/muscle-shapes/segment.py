"""Segmenta por MASCARA de referencia + reparto elipse.

Idea: el artista ya proporciona una imagen con TODOS los musculos pintados
(painted-{view}.png). Extraemos el conjunto exacto de pixeles "musculo" del
rojo del painting; luego, por cada musculo, lo partimos usando elipses de
seed. Cada pixel rojo se asigna al musculo cuya elipse lo contiene MEJOR
(distancia normalizada minima). Asi dos elipses solapadas no pintan dos
veces: el musculo mas cercano se lo lleva.

Ventajas sobre el region-growing viejo:
  - La silueta sale directamente del arte, no de BFS sobre luminancia -->
    cada musculo queda con su forma anatomica real.
  - Elipses amplias no desbordan: el pixel debe estar ADEMAS pintado de
    rojo. Si una elipse incluye el pantalon, el pantalon no es rojo y no
    se pinta.
  - Musculos adyacentes (pec/delt, quads/abductors) se separan limpiamente.
"""
import json
import sys
from PIL import Image, ImageFilter

TARGET_W, TARGET_H = 680, 1200
SCALE = 2  # segmentamos a mitad de resolucion, final se escala x SCALE


def load_mask(painted_path):
    """Pixeles donde domina el rojo del pintado. Trabaja a mitad de res."""
    im = Image.open(painted_path).convert("RGB").resize(
        (TARGET_W // SCALE, TARGET_H // SCALE), Image.LANCZOS
    )
    px = im.load()
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    mpx = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # Rojo dominante + suficientemente luminoso. Los umbrales
            # soportan matices entre rojo intenso (R~220) y rosa suave de
            # las zonas sombreadas (R~140).
            if r > 100 and r > g * 1.35 and r > b * 1.35:
                mpx[x, y] = 255
    return mask, (w, h)


def ellipse_assign(mask, size, spec):
    """Para cada pixel rojo, encuentra el (muscle, part_index) duena.

    Devuelve dict: muscle -> lista de pixeles. Reparto por distancia
    normalizada en espacio eliptico: d = (x-cx)^2/rx^2 + (y-cy)^2/ry^2.
    Un pixel queda huerfano (no asignado) si no esta dentro de ninguna
    elipse (d > 1 para todas).
    """
    w, h = size
    mpx = mask.load()
    # Listamos todas las partes con su elipse ya en coord de trabajo (SCALE).
    parts = []
    for muscle, cfg in spec.items():
        for cx, cy, rx, ry in cfg["parts"]:
            parts.append(
                (muscle, cx / SCALE, cy / SCALE, rx / SCALE, ry / SCALE)
            )
    out = {m: [] for m in spec}
    for y in range(h):
        for x in range(w):
            if mpx[x, y] < 128:
                continue
            best = None
            best_d = 1.0
            for muscle, cx, cy, rx, ry in parts:
                dx = (x - cx) / rx
                dy = (y - cy) / ry
                d = dx * dx + dy * dy
                if d < best_d:
                    best_d = d
                    best = muscle
            if best is not None:
                out[best].append((x, y))
    return out


def to_mask_img(pixels, size, close):
    m = Image.new("L", size, 0)
    px = m.load()
    for x, y in pixels:
        px[x, y] = 255
    # Cierre morfologico para unir bloques (p.ej. abs tiene estriaciones)
    return m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))


def largest_component(mask):
    """BFS -> devuelve mascara con solo el componente mayor.

    Un musculo pintado puede tener varias "islas" (dos glúteos, dos lados
    del abs) dentro de UNA elipse; si queremos un path por parte hay que
    tratarlas aparte. En este flow las "parts" ya son los dos lados, asi
    que dentro de cada part esperamos UN componente — con el close
    morfologico encima nos quedamos con el mayor.
    """
    w, h = mask.size
    px = mask.load()
    best = []
    seen = [[False] * h for _ in range(w)]
    for y0 in range(h):
        for x0 in range(w):
            if px[x0, y0] < 128 or seen[x0][y0]:
                continue
            stack = [(x0, y0)]
            seen[x0][y0] = True
            comp = []
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and px[nx, ny] >= 128:
                        seen[nx][ny] = True
                        stack.append((nx, ny))
            if len(comp) > len(best):
                best = comp
    out = Image.new("L", (w, h), 0)
    opx = out.load()
    for x, y in best:
        opx[x, y] = 255
    return out


def trace(mask):
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
    for _ in range(40000):
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


def segment_part(pixels, size, close, eps):
    """Pipeline per-part: mask -> cerrado -> mayor componente -> trazo -> simplifica -> path."""
    if len(pixels) < 20:
        return None
    m = to_mask_img(pixels, size, close)
    m = largest_component(m)
    c = trace(m)
    if len(c) < 8:
        return None
    simple = rdp_closed(c, eps)
    if len(simple) < 4:
        return None
    return smooth_path(simple)


def main():
    out_dir, spec_path = sys.argv[1], sys.argv[2]
    spec = json.load(open(spec_path, encoding="utf-8"))
    result = {}
    for view in ("front", "back"):
        painted = f"{out_dir}/painted-{view}.png"
        mask, size = load_mask(painted)
        result[view] = {}
        # Reparto PIXEL -> MUSCLE usando todas las elipses del view.
        assigned = ellipse_assign(mask, size, spec[view])
        # Pero necesitamos path POR PART (izq + der). Re-asignamos pixeles
        # por part concreta DENTRO del pool ya ganado por el musculo.
        for muscle, cfg in spec[view].items():
            muscle_pix = set(assigned[muscle])
            parts_paths = []
            for cx, cy, rx, ry in cfg["parts"]:
                cx_, cy_, rx_, ry_ = cx / SCALE, cy / SCALE, rx / SCALE, ry / SCALE
                owned = []
                for (x, y) in muscle_pix:
                    dx = (x - cx_) / rx_
                    dy = (y - cy_) / ry_
                    if dx * dx + dy * dy <= 1.0:
                        owned.append((x, y))
                path = segment_part(
                    owned, size, cfg.get("close", 5), cfg.get("eps", 1.4)
                )
                if path:
                    parts_paths.append(path)
            if parts_paths:
                result[view][muscle] = parts_paths
    json.dump(result, open(f"{out_dir}/paths.json", "w", encoding="utf-8"))
    print("front:", sorted(result["front"].keys()))
    print("back:", sorted(result["back"].keys()))


if __name__ == "__main__":
    main()
