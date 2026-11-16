// SVG body silhouette (front or back) with highlighted muscle layers.

import {
  BODY_VIEWBOX,
  SILHOUETTE,
  HAIR,
  DECOR,
  shapesFor,
  allMuscleShapes,
} from '../../lib/muscleShapes.js'

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
