# Siluetas del mapa muscular

Genera `web/src/lib/muscleShapes.js` a partir del arte vectorial en `svg/`.

## Por qué existe

El arte (`svg/vista-frontal.svg`, `svg/vista-trasera.svg`) ya es vectorial: cada
músculo es un `<path>` con id propio. No hay que segmentar imágenes rasterizadas
(eso hacía el pipeline viejo, ya retirado). Aquí solo transformamos esos paths
al formato que consume el componente.

Tres cosas no triviales que resuelve `vectorize.mjs`:

1. **Espejo.** El lado `derecha` no trae coordenadas propias: es el `izquierda`
   reflejado con `transform="translate(T,0) scale(-1,1)"`. El script reaplica
   ese reflejo (`x → T - x`) para tener coordenadas reales de los dos lados.
2. **Nombres laxos → enum real.** El artista agrupó con nombres anatómicamente
   gruesos: el grupo `abdominal` incluye abdominales, deltoides, bíceps y
   serrato; `dorsal` incluye dorsales y tríceps. La tabla `ID_MAP`/`BASE_MAP`
   del script traduce cada id concreto al músculo del enum de la app. Lo que no
   es músculo entrenable (manos, pies, espinilla, pelo) va a la silueta gris.
3. **Normalizado.** Cada figura está descentrada en su lienzo `1920×1920` y las
   dos miden distinto. Se reescalan a la misma altura y se centran en un lienzo
   común, para que el giro 3D de la card no cambie la escala de la figura.

## Uso

```bash
node tools/muscle-shapes/vectorize.mjs
```

Escribe directamente `web/src/lib/muscleShapes.js`. Solo Node, sin dependencias.

Reejecutar solo hace falta si cambia el arte en `svg/` o la tabla de mapeo. El
módulo generado no se edita a mano.

## Si cambia el arte

`svg/` es la copia versionada (el arte original vive en `docs/design/`, que está
gitignored). Para actualizar: reemplaza los dos SVG en `svg/`, revisa que los
ids de músculo sigan el esquema `base-izq|der[-N]-frontal|trasera`, ajusta la
tabla de mapeo en `vectorize.mjs` si aparecen grupos nuevos, y reejecuta.
