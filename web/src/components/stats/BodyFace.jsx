import {
  BODY_VIEWBOX,
  SILHOUETTE,
  HAIR,
  DECOR,
  shapesFor,
  allMuscleShapes,
} from '../../lib/muscleShapes.js'

/*
  Una cara del cuerpo (frente o espalda) como SVG vectorial.

  Extraído de MuscleMap.jsx para que otras superficies puedan reutilizar el
  render sin arrastrar la card, el flip 3D ni la leyenda.

  El arte es vectorial (no un render ráster), así que cada músculo es un
  trazado con relleno plano: no hace falta el truco viejo de dos pasadas
  (lighten gris + multiply) que existía solo para teñir una foto. Las capas,
  de atrás a delante:

    1. SILHOUETTE — el contorno del cuerpo, gris claro.
    2. músculos de base (allMuscleShapes) + DECOR (manos, pies, espinilla),
       en gris muscular: la figura siempre se ve "con músculos".
    3. `layers` — los músculos entrenados, encendidos con color y opacidad.
    4. HAIR — el pelo, encima.

  API — `layers`
    Cada entrada: { muscles: [id...], color: 'var(--color-...)', opacity }.
    El orden define el z-order; lo que va antes queda debajo. El consumidor
    decide colores y opacidad; aquí solo pintamos.
*/

// Gris de los músculos sin encender y del contorno. color-mix para que se
// adapten al tema sin hardcodear un hex que solo valga en oscuro.
const BODY_FILL = 'var(--color-surface-3)'
const MUSCLE_FILL = 'color-mix(in srgb, var(--color-text-muted) 32%, var(--color-surface-3))'
const HAIR_FILL = 'color-mix(in srgb, var(--color-text-muted) 55%, var(--color-surface-3))'

export default function BodyFace({ view, layers = [], label, className }) {
  const { width, height } = BODY_VIEWBOX
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={`${className} h-full w-full`}
    >
      <g fill={BODY_FILL}>
        {SILHOUETTE[view].map((d, i) => (
          <path key={`b${i}`} d={d} />
        ))}
      </g>

      <g fill={MUSCLE_FILL}>
        {allMuscleShapes(view).map((d, i) => (
          <path key={`m${i}`} d={d} />
        ))}
        {DECOR[view].map((d, i) => (
          <path key={`d${i}`} d={d} />
        ))}
      </g>

      {layers.map((layer, i) => (
        <g key={`l${i}`} fill={layer.color} opacity={layer.opacity}>
          {shapesFor(view, layer.muscles).map((d, j) => (
            <path key={j} d={d} />
          ))}
        </g>
      ))}

      <g fill={HAIR_FILL}>
        {HAIR[view].map((d, i) => (
          <path key={`h${i}`} d={d} />
        ))}
      </g>
    </svg>
  )
}
