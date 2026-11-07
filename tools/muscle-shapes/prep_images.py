"""Normaliza las 4 imagenes de docs/design/components/muscles a 680x1200
alineadas (misma caja del cuerpo). Produce:
  - body-front.webp, body-back.webp  (bases limpias, van al asset bundle)
  - painted-front.png, painted-back.png  (referencias con TODOS los musculos
    pintados en rojo; de aqui salen las mascaras per-vista)
"""
from pathlib import Path
import sys
from PIL import Image

TARGET_W, TARGET_H = 680, 1200
# Dejamos un cinturon de pixeles de padding alrededor del cuerpo dentro del
# canvas destino. El figurin original tiene cabeza hasta pies tocando el
# borde superior/inferior; 50px de aire arriba y abajo evita que el pelo o
# los dedos de los pies se recorten tras el blur de resize.
BODY_HEIGHT_TARGET = 1100


def body_bbox(im):
    """bbox del cuerpo (no-fondo) en pixeles de la imagen."""
    px = im.convert("RGBA").load()
    w, h = im.size
    xs = []
    ys = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 20 and (r + g + b) / 3 > 15:
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs), max(ys))


def crop_resize(src_path, dst_path, bbox):
    """Crop al bbox del cuerpo + resize proporcional para que la altura del
    cuerpo = BODY_HEIGHT_TARGET y centrado horizontal en TARGET_W x TARGET_H.
    """
    im = Image.open(src_path).convert("RGBA")
    x1, y1, x2, y2 = bbox
    body_w = x2 - x1
    body_h = y2 - y1
    scale = BODY_HEIGHT_TARGET / body_h
    new_body_w = int(round(body_w * scale))
    # Crop ajustado al cuerpo (+ pequeno margen para que RDP no se coma
    # bordes tras el resize).
    pad = int(round(10 / scale))
    cx1 = max(0, x1 - pad)
    cy1 = max(0, y1 - pad)
    cx2 = min(im.size[0], x2 + pad)
    cy2 = min(im.size[1], y2 + pad)
    cropped = im.crop((cx1, cy1, cx2, cy2))
    # Resize al tamano del cuerpo destino
    new_w = int(round((cx2 - cx1) * scale))
    new_h = int(round((cy2 - cy1) * scale))
    resized = cropped.resize((new_w, new_h), Image.LANCZOS)
    # Pegar en canvas final, cuerpo centrado
    canvas = Image.new("RGBA", (TARGET_W, TARGET_H), (0, 0, 0, 0))
    offset_x = (TARGET_W - new_w) // 2
    offset_y = (TARGET_H - new_h) // 2
    canvas.paste(resized, (offset_x, offset_y), resized)
    canvas.convert("RGB" if dst_path.endswith(".webp") else "RGBA").save(dst_path)
    print(f"escrito {dst_path} ({new_w}x{new_h} body en {TARGET_W}x{TARGET_H})")


def main():
    src_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    for view in ("front", "back"):
        clean = src_dir / f"muscles_{view}.png"
        painted = src_dir / f"muscles_{view}_example.jpg"
        # El bbox lo calculamos del PAINTED porque el cuerpo esta en la misma
        # posicion en ambos (los ejemplos son sobre el mismo render) y asi
        # garantizamos alineacion perfecta mascara/raster.
        bbox_painted = body_bbox(Image.open(painted))
        # Para la version limpia, si viene en resolucion distinta, calculamos
        # su propio bbox y hacemos la misma escala relativa.
        im_clean = Image.open(clean)
        if im_clean.size == Image.open(painted).size:
            bbox_clean = bbox_painted
        else:
            bbox_clean = body_bbox(im_clean)
        crop_resize(str(clean), str(out_dir / f"body-{view}.webp"), bbox_clean)
        crop_resize(str(painted), str(out_dir / f"painted-{view}.png"), bbox_painted)


if __name__ == "__main__":
    main()
