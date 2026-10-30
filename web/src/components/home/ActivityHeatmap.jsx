import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { levelsFromCells } from '../../lib/stats.js'

/*
  Rejilla tipo GitHub: 7 filas × N semanas, con labels de mes arriba y días
  (lun/mié/vie) a la izquierda. Los días futuros se pintan como celda vacía
  pero no se agrupan con "no entreno". Los días fuera del año seleccionado
  (semanas que empiezan en diciembre del año anterior o terminan en enero
  del siguiente) se renderizan invisibles para que la rejilla no mienta.

  En mobile se habilita overflow horizontal: un año completo son 53 columnas
  y no caben a 375 px. El contenedor fija un min-width que escala con las
  semanas; el usuario arrastra lateral si hace falta.
*/

const LEVEL_CLASSES = [
  'bg-[color-mix(in_srgb,var(--color-border)_55%,transparent)]',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
]

// Lun = 0, Mar = 1, …, Dom = 6. Una fecha "ancla" de un lunes conocido
// (2024-01-01 era lunes) basta para formatear los nombres cortos vía Intl.
const MON_ANCHOR = new Date(2024, 0, 1)

function dayLabels(locale) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const names = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(MON_ANCHOR)
    d.setDate(MON_ANCHOR.getDate() + i)
    names.push(fmt.format(d).replace('.', ''))
  }
  return names
}

function monthLabels(cells, weeks, locale) {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  const out = []
  let lastMonth = -1
  for (let w = 0; w < weeks; w++) {
    // El "lunes" de la columna es la primera celda del grupo de 7.
    const monday = cells[w * 7]?.date
    if (!monday) continue
    const m = monday.getMonth()
    if (m !== lastMonth) {
      out.push({ col: w, label: fmt.format(new Date(2024, m, 1)).replace('.', '') })
      lastMonth = m
    }
  }
  return out
}

function RangeTabs({ ranges, value, onChange, t }) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 rounded-control bg-bg p-1 text-xs"
    >
      {ranges.map((r) => {
        const label = r === '12w' ? t('home.range12Weeks') : String(r)
        const active = value === r
        return (
          <button
            key={r}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(r)}
            className={`rounded-[10px] px-2.5 py-1 font-medium transition-colors ${
              active
                ? 'bg-surface-2 text-text shadow-card'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function ActivityHeatmap({
  cells,
  weeks,
  loading,
  range,
  availableRanges,
  onRangeChange,
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const levels = useMemo(() => levelsFromCells(cells), [cells])
  const days = useMemo(() => dayLabels(locale), [locale])
  const months = useMemo(
    () => monthLabels(cells, weeks, locale),
    [cells, weeks, locale],
  )

  const ariaLabel =
    range === '12w'
      ? t('home.last12Weeks')
      : t('home.yearActivity', { year: range })

  /*
    Tamaño de celda FIJO (12 px) + gap FIJO (3 px). Antes la rejilla usaba
    1fr por columna y se estiraba al ancho disponible: 12 semanas = celdas
    gigantes, 53 semanas = celdas razonables. Al fijar el tamaño, 12 w
    ocupa su ancho natural (~195 px) y queda compacta y legible, mientras
    que un año (~865 px) sigue necesitando el overflow-x. La escala así es
    la misma a 12 semanas que a un año — como en GitHub.
  */
  const CELL = 12
  const GAP = 3
  const STEP = CELL + GAP

  return (
    <section className="card-liquid rounded-container p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold tracking-tight text-text">
          {t('home.activity')}
        </h2>
        <RangeTabs
          ranges={availableRanges}
          value={range}
          onChange={onRangeChange}
          t={t}
        />
      </div>

      <div className="scrollbar-hidden overflow-x-auto">
        <div className="inline-block">
          {/* Etiquetas de mes posicionadas por columna real (no por %) */}
          <div
            className="relative mb-1.5 ml-[36px] h-3 text-[10px] text-text-muted"
            style={{ width: `${weeks * STEP - GAP}px` }}
          >
            {months.map(({ col, label }) => (
              <span
                key={col}
                className="absolute whitespace-nowrap capitalize"
                style={{ left: `${col * STEP}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {/* Columna de días (lun/mié/vie visibles, el resto en blanco
                para no cargar y mantener alineación por fila) */}
            <div
              className="grid gap-[3px] text-[10px] text-text-muted"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                width: '32px',
              }}
            >
              {days.map((d, i) => (
                <span
                  key={i}
                  className="flex items-center capitalize leading-none"
                >
                  {i % 2 === 1 ? d : ''}
                </span>
              ))}
            </div>

            {/* Rejilla de celdas con tamaño fijo */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`,
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoFlow: 'column',
                gap: `${GAP}px`,
              }}
              role="img"
              aria-label={ariaLabel}
            >
              {cells.map((cell, i) => {
                if (cell.isOutside) {
                  return (
                    <div
                      key={i}
                      className="pointer-events-none"
                      aria-hidden
                    />
                  )
                }
                const level = cell.isFuture ? 0 : levels[i]
                return (
                  <div
                    key={i}
                    className={`rounded-[2px] ${LEVEL_CLASSES[level]} ${
                      cell.isToday ? 'ring-1 ring-accent/60' : ''
                    }`}
                    title={`${cell.dateKey} · ${cell.count}`}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-text-muted">
        <span className="tabular">
          {loading ? '…' : t('home.sessionsTotal', { count: totalCount(cells) })}
        </span>
        <div className="flex items-center gap-2">
          <span>{t('home.legendLess')}</span>
          {LEVEL_CLASSES.slice(1).map((cls, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${cls}`} />
          ))}
          <span>{t('home.legendMore')}</span>
        </div>
      </div>
    </section>
  )
}

function totalCount(cells) {
  let n = 0
  for (const c of cells) if (!c.isOutside) n += c.count
  return n
}
