/*
  Heatmap decorativo del hero de la Landing. No consume datos reales (no hay
  usuario aún); genera un patrón determinista para que siempre tenga la
  misma estética y evitar el flicker de un random en cada render. Se puede
  renderizar en dos tamaños: "compact" (mobile, 14 columnas) y "wide"
  (desktop, 26 columnas) que coinciden con los textos "Últimas 18/26 semanas"
  del mockup. 7 filas = días de la semana (igual que el heatmap de GitHub).
*/

const LEVELS = [
  'bg-[color-mix(in_srgb,var(--color-border)_55%,transparent)]',
  'bg-heat-1',
  'bg-heat-2',
  'bg-heat-3',
  'bg-heat-4',
]

const ROWS = 7

// LCG determinista: misma semilla -> misma rejilla cada vez.
function makeGrid(cols, rows, seed) {
  const cells = []
  let x = seed
  for (let i = 0; i < cols * rows; i++) {
    x = (x * 1664525 + 1013904223) % 4294967296
    const r = (x >>> 0) / 4294967296
    // Sesgo hacia niveles bajos para que no sea una pared verde.
    let level = 0
    if (r > 0.3) level = 1
    if (r > 0.55) level = 2
    if (r > 0.78) level = 3
    if (r > 0.92) level = 4
    cells.push(level)
  }
  return cells
}

export default function HeatmapPreview({ size = 'compact' }) {
  const cols = size === 'wide' ? 26 : 14
  const cells = makeGrid(cols, ROWS, size === 'wide' ? 26 : 18)
  const weeksLabel = size === 'wide' ? 'Últimas 26 semanas' : 'Últimas 18 semanas'

  return (
    <div className="rounded-container bg-surface p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm text-text-muted">{weeksLabel}</span>
        <span className="text-sm font-semibold text-accent">Racha · 5 días</span>
      </div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cells.map((level, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[2px] ${LEVELS[level]}`}
          />
        ))}
      </div>
    </div>
  )
}
