import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import bodyFront from '../assets/muscles/body-front.webp'
import bodyBack from '../assets/muscles/body-back.webp'
import { BODY_VIEWBOX, shapesFor } from '../lib/muscleShapes.js'

/*
  Mapa corporal de la semana. Colorea los músculos sobre un render anatómico
  que gira en 3D entre frente y espalda.

  Cómo se colorea un PNG
  ----------------------
  Los renders son imágenes rasterizadas, así que no hay regiones que colorear
  por selector. Encima va una capa SVG con la SILUETA de cada músculo
  (`lib/muscleShapes.js`, derivadas de la propia imagen; ver el script en
  tools/muscle-shapes). No son manchas redondas encima del músculo: el
  contorno sigue el dibujo.

  Dos pasadas superpuestas por capa, cada una con su modo de fusión:

  1. `lighten` con un gris medio. Solo sube los píxeles oscuros y deja intacto
     el cuerpo, que ya es más claro. Existe por el pantalón del render:
     multiply sobre un gris casi negro da un granate invisible y los glúteos
     no se veían.
  2. `multiply` con el color real de la capa. Multiply y no un relleno opaco
     porque conserva las estriaciones del dibujo debajo: el músculo se tiñe,
     no se tapa.

  El contenedor lleva `isolation: isolate` para que la fusión no escape de la
  card y tiña el fondo de la página.

  API — `layers`
  --------------
  Cada entrada del array es una capa independiente: una lista de muscle ids,
  un color (CSS var — p. ej. `var(--color-muscle)`) y una opacidad. Permite
  pintar el mapa con el acento rojo del volumen, con ámbar para
  recuperación, con gris para los músculos descuidados — o cualquier
  combinación. El orden del array manda el z-order: lo que va antes queda
  debajo. El consumidor decide; aquí solo pintamos.

  El giro es una transición CSS y no `motion`: la regla global de
  `prefers-reduced-motion` en index.css ya lleva toda transition-duration a 0,
  así que el cambio de cara se vuelve instantáneo sin código extra.
*/

// Suelo de luminancia para que el pantalón del render acepte el tinte.
const FLOOR_GRAY = '#787878'

function HeatLayer({ view, layers, blend, forceColor }) {
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

function BodyFace({ view, src, layers, alt, className }) {
  return (
    <div className={`${className} isolate overflow-hidden`}>
      <img src={src} alt={alt} className="h-full w-full object-contain" />
      {/*
        Primera pasada: gris para iluminar píxeles oscuros. Todas las capas
        van con el mismo gris; sus opacidades individuales todavía controlan
        cuánto se aclara cada grupo.
      */}
      <HeatLayer view={view} layers={layers} blend="lighten" forceColor={FLOOR_GRAY} />
      {/* Segunda pasada: el color real de cada capa. */}
      <HeatLayer view={view} layers={layers} blend="multiply" />
    </div>
  )
}

export default function MuscleMap({ title, subtitle, layers = [], legendItems = [] }) {
  const { t } = useTranslation()
  const [showBack, setShowBack] = useState(false)

  return (
    <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-xs text-text-muted">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowBack((v) => !v)}
          aria-pressed={showBack}
          className="press shrink-0 rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
        >
          {showBack ? t('weekStats.showFront') : t('weekStats.showBack')}
        </button>
      </div>

      {/*
        perspective en el padre + preserve-3d en el que gira. Las dos caras van
        absolute para ocupar la misma caja; la altura la fija el aspect-ratio.
      */}
      <div className="mx-auto w-full max-w-[320px]" style={{ perspective: '1400px' }}>
        <div
          className="relative transition-transform duration-700 ease-in-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: showBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
            aspectRatio: `${BODY_VIEWBOX.width} / ${BODY_VIEWBOX.height}`,
          }}
        >
          <BodyFace
            view="front"
            src={bodyFront}
            layers={layers}
            alt={t('weekStats.bodyFrontAlt')}
            className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
          />
          <BodyFace
            view="back"
            src={bodyBack}
            layers={layers}
            alt={t('weekStats.bodyBackAlt')}
            className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
          />
        </div>
      </div>

      {legendItems.length > 0 && (
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
          {legendItems.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    item.opacity != null
                      ? `color-mix(in srgb, ${item.color} ${Math.round(
                          item.opacity * 100,
                        )}%, transparent)`
                      : item.color,
                }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
