import { BODY_VIEWBOX, shapesFor } from '../../lib/muscleShapes.js'

/*
  Cara del cuerpo con capa de siluetas musculares.

  Extraído de MuscleMap.jsx para que MiniMuscleMap (Home) reutilice el
  mismo render sin arrastrar la card, el flip 3D ni la leyenda. El
  algoritmo de fusión (lighten gris + multiply color) vive aquí para que
  ambas superficies pinten exactamente igual — si lo tocamos en un sitio
  y no en el otro, dos pantallas enseñarían dos variantes del mismo
  músculo.

  API — `layers`
    Cada entrada: { muscles: [id...], color: 'var(--color-...)', opacity }.
    El orden del array define el z-order; lo que va antes queda debajo.
    `view` elige qué plano del cuerpo se mapea: 'front' o 'back'.
*/

export const FLOOR_GRAY = '#787878'

export function HeatLayer({ view, layers, blend, forceColor }) {
  return (
    <svg
      viewBox={`0 0 ${BODY_VIEWBOX.width} ${BODY_VIEWBOX.height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ mixBlendMode: blend }}
    >
      {layers.map((layer, i) => (
        <g key={i} opacity={layer.opacity} fill={forceColor ?? layer.color}>
          {shapesFor(view, layer.muscles).map((d, j) => (
            <path key={j} d={d} />
          ))}
        </g>
      ))}
    </svg>
  )
}

export default function BodyFace({ view, src, layers, alt, className }) {
  return (
    <div className={`${className} isolate overflow-hidden`}>
      <img src={src} alt={alt} className="h-full w-full object-contain" />
      <HeatLayer view={view} layers={layers} blend="lighten" forceColor={FLOOR_GRAY} />
      <HeatLayer view={view} layers={layers} blend="multiply" />
    </div>
  )
}
