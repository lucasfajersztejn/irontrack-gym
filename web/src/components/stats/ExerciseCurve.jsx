import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/*
  Curva histórica + KPIs de un ejercicio. Extraído del antiguo CurveBlock
  interno de ExerciseProgressRow para poder reutilizarlo en
  SelectedWorkoutCard (Home) con dos extras:

    - `range`: '12w' | 'year' | 'all'. Filtra los puntos en cliente
      (el endpoint devuelve todos). Los KPIs se recalculan sobre el
      subconjunto filtrado — "max en este rango" es un dato más útil
      que "max histórico" cuando el usuario navega por ventanas.
    - `highlightDate`: fecha ISO de la sesión seleccionada. Si existe
      dentro del rango, pintamos un ReferenceDot grande encima del
      punto para marcarlo como "estás viendo ESTE día".

  Formatea las fechas con el locale activo y respeta prefers-reduced-motion.
*/

function cutoffFor(range, now = new Date()) {
  if (range === 'all') return null
  if (range === 'year') {
    const d = new Date(now.getFullYear(), 0, 1)
    return d.getTime()
  }
  // Default 12 semanas (84 días).
  return now.getTime() - 84 * 86_400_000
}

function formatKg(kg) {
  if (kg == null) return '—'
  return Number.isInteger(kg)
    ? String(kg)
    : (Math.round(kg * 10) / 10).toString()
}

export default function ExerciseCurve({
  points,
  range = '12w',
  highlightDate = null,
}) {
  const { t, i18n } = useTranslation()

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || 'es', {
        day: '2-digit',
        month: 'short',
      }),
    [i18n.language],
  )

  // prefers-reduced-motion decide `isAnimationActive`. Valor estable al
  // montar: suficiente en este contexto (no cambiamos rango sin remount
  // del gráfico porque Recharts re-anima ya).
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const filtered = useMemo(() => {
    if (!points) return []
    const cutoff = cutoffFor(range)
    const rows = cutoff == null
      ? points
      : points.filter((p) => new Date(p.date).getTime() >= cutoff)
    return rows
  }, [points, range])

  const data = useMemo(
    () =>
      filtered.map((p) => ({
        x: new Date(p.date).getTime(),
        heaviestKg: p.heaviestKg,
        best1RM: p.best1RM,
      })),
    [filtered],
  )

  const summary = useMemo(() => {
    if (filtered.length === 0) return null
    let maxWeight = 0
    let maxOneRm = 0
    for (const p of filtered) {
      if (p.heaviestKg > maxWeight) maxWeight = p.heaviestKg
      if (p.best1RM > maxOneRm) maxOneRm = p.best1RM
    }
    return { maxWeight, maxOneRm, sessions: filtered.length }
  }, [filtered])

  const highlight = useMemo(() => {
    if (!highlightDate || filtered.length === 0) return null
    const target = new Date(highlightDate).getTime()
    // Buscamos el punto exacto (no un vecino). Si la sesión seleccionada
    // no cae dentro del rango filtrado, no pintamos nada — es
    // intencional: el ReferenceDot fuera del dominio flota feo.
    const match = filtered.find(
      (p) => new Date(p.date).getTime() === target,
    )
    return match ?? null
  }, [filtered, highlightDate])

  if (!summary) {
    return (
      <p className="text-xs text-text-muted">
        {t('weekStats.exerciseCurve.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Kpi
          label={t('weekStats.exerciseCurve.heaviest')}
          value={`${formatKg(summary.maxWeight)} kg`}
        />
        <Kpi
          label={t('weekStats.exerciseCurve.best1rm')}
          value={`${formatKg(summary.maxOneRm)} kg`}
          accent
        />
        <Kpi
          label={t('weekStats.exerciseCurve.sessions')}
          value={t('weekStats.exerciseCurve.sessionsCount', {
            count: summary.sessions,
          })}
        />
      </div>

      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          >
            <CartesianGrid
              stroke="var(--color-border)"
              strokeOpacity={0.35}
              vertical={false}
            />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => dateFmt.format(new Date(v))}
              stroke="var(--color-text-muted)"
              fontSize={10}
              tickMargin={6}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)', strokeOpacity: 0.5 }}
            />
            <YAxis
              stroke="var(--color-text-muted)"
              fontSize={10}
              width={32}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--color-text)',
              }}
              labelFormatter={(v) => dateFmt.format(new Date(v))}
              formatter={(value, name) => [`${formatKg(value)} kg`, name]}
            />
            <Line
              type="monotone"
              dataKey="heaviestKg"
              name={t('weekStats.exerciseCurve.heaviestSeries')}
              stroke="var(--color-text-muted)"
              strokeWidth={1.75}
              dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--color-text-muted)' }}
              activeDot={{ r: 4 }}
              isAnimationActive={!reduceMotion}
            />
            <Line
              type="monotone"
              dataKey="best1RM"
              name={t('weekStats.exerciseCurve.best1rmSeries')}
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-accent)' }}
              activeDot={{ r: 5 }}
              isAnimationActive={!reduceMotion}
            />
            {highlight && (
              <ReferenceDot
                x={new Date(highlight.date).getTime()}
                y={highlight.best1RM}
                r={6}
                fill="var(--color-accent)"
                stroke="var(--color-bg)"
                strokeWidth={2}
                isFront
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }) {
  return (
    <div className="rounded-card bg-bg/60 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
      </p>
      <p
        className={`tabular font-display text-sm font-semibold ${
          accent ? 'text-accent' : 'text-text'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
