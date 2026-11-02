# Siluetas del mapa muscular

Genera `web/src/lib/muscleShapes.js` a partir de los renders anatómicos de
`web/src/assets/muscles/`.

## Por qué existe

Los renders son imágenes rasterizadas, así que no hay regiones que colorear
por selector. Pintar manchas redondas encima no sirve: se ve un círculo sobre
el músculo, no el músculo coloreado.

El dibujo ya separa cada músculo con pliegues oscuros. El script crece una
región desde el centro de cada músculo aceptando solo píxeles claros, de modo
que el relleno **se detiene solo en esos pliegues** y toma la forma real. El
contorno resultante se simplifica y se exporta como trazado SVG.

`seeds.json` guarda, por músculo y vista, el punto de partida y la elipse que
limita el crecimiento máximo (para que un relleno que se escape por un hueco
del contorno no se coma media pierna), más los umbrales de brillo.

## Uso

```bash
python tools/muscle-shapes/segment.py <dir-con-las-webp> tools/muscle-shapes/seeds.json
```

Escribe `paths.json` en ese directorio; de ahí sale el módulo JS. Solo
necesita Pillow.

Reejecutarlo solo hace falta si cambian las imágenes del cuerpo. El módulo
generado no se edita a mano.
