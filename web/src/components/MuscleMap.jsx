// Front/back muscle map with highlighted layers, legend and view toggle.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BODY_VIEWBOX } from '../lib/muscleShapes.js'
import BodyFace from './stats/BodyFace.jsx'

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
            layers={layers}
            label={t('weekStats.bodyFrontAlt')}
            className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden]"
          />
          <BodyFace
            view="back"
            layers={layers}
            label={t('weekStats.bodyBackAlt')}
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
