import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { useExerciseProgress } from '../../lib/useExerciseProgress.js'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'

/*
  Fila de ejercicio dentro de una sesión expandida en /stats/week.

  Para los ejercicios de `weight_reps` con id en catálogo, la fila es
  expandible: al abrirla pedimos GET /api/exercises/:id/progress y
  mostramos dos curvas (peso máx y 1RM estimado) con los puntos de todas
  las sesiones del usuario — la ventana de la semana solo decide desde
  qué fila se entra, no limita el rango de la curva.

  Para el resto de trackings (reps, time, distance_time) o si no hay
  exerciseId por una sesión muy antigua sin populate, mantenemos la
  estética actual: nombre + nº de series + pills de detalle, sin
  chevron ni expansión. La misma decisión que en SessionExerciseCard
  (línea viva solo para weight_reps) — quien no tiene 1RM no gana nada
  con un gráfico vacío.
*/
export default function ExerciseProgressRow({
  ex,
  aliases,
  aliasLang,
  formatDetail,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const expandable = ex.tracking === 'weight_reps' && !!ex.exerciseId
  const { loading, error, points } = useExerciseProgress(ex.exerciseId, open)

  const name = resolveExerciseName(ex, aliases, aliasLang)

  const chartData = useMemo(() => {
    if (!points) return []
    return points.map((p) => ({
      // Timestamp numérico para el eje X: Recharts ordena bien sobre
      // números y el formateador decide la etiqueta visible.
      x: new Date(p.date).getTime(),
      heaviestKg: p.heaviestKg,
      best1RM: p.best1RM,
    }))
  }, [points])

  const summary = useMemo(() => {
    if (!points || points.length === 0) return null
    let maxWeight = 0
    let maxOneRm = 0
    for (const p of points) {
      if (p.heaviestKg > maxWeight) maxWeight = p.heaviestKg
      if (p.best1RM > maxOneRm) maxOneRm = p.best1RM
    }
    return {
      maxWeight,
      maxOneRm,
      sessions: points.length,
    }
  }, [points])

  return (
    <li className="rounded-card bg-surface-2">
      <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {expandable ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={
                open
                  ? t('weekStats.exerciseCurve.collapseAria', { name })
                  : t('weekStats.exerciseCurve.expandAria', { name })
              }
              className="press -mx-1 flex w-full items-center gap-2 rounded-card px-1 py-0.5 text-left transition-[filter,transform,color] hover:text-accent"
            >
              <ChevronRightIcon
                className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${
                  open ? 'rotate-90' : ''
                }`}
              />
              <p className="truncate text-sm font-medium text-text">{name}</p>
            </button>
          ) : (
            <p className="truncate text-sm font-medium text-text">{name}</p>
          )}
        </div>
        <p className="tabular shrink-0 text-xs text-text-muted">
          {t('training.stats.setsCount', { count: ex.sets.length })}
        </p>
      </div>

      {ex.sets.length > 0 && (
        <ul className="tabular flex flex-wrap gap-1.5 px-3 pb-2.5 text-[11px] text-text-muted">
          {ex.sets.map((s, j) => (
            <li
              key={j}
              className="rounded-pill border border-border bg-bg px-2 py-0.5"
            >
              {formatDetail(s, ex.tracking)}
            </li>
          ))}
        </ul>
      )}

      {expandable && open && (
        <div className="border-t border-border/60 px-3 py-3">
          {loading && (
            <p className="text-xs text-text-muted">
              {t('weekStats.exerciseCurve.loading')}
            </p>
          )}
          {error && !loading && (
            <p className="text-xs text-error">
              {t('weekStats.exerciseCurve.loadError')}
            </p>
          )}
          {!loading && !error && points && points.length === 0 && (
            <p className="text-xs text-text-muted">
              {t('weekStats.exerciseCurve.empty')}
            </p>
          )}
          {!loading && !error && summary && (
            <CurveBlock summary={summary} data={chartData} />
          )}
        </div>
      )}
    </li>
  )
}

/*
  KPIs + gráfico. Se renderiza aislado para no tocar el layout de la
  fila cuando los datos aún no llegaron.
*/
function CurveBlock({ summary, data }) {
  const { t, i18n } = useTranslation()

  // Formateador de fecha corto para el eje X y el tooltip. Compartido
  // para que la etiqueta del tooltip coincida con el tick visible.
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || 'es', {
        day: '2-digit',
        month: 'short',
      }),
    [i18n.language],
  )

  // prefers-reduced-motion decide `isAnimationActive`. No usamos un
  // hook con listener porque la curva solo se monta al abrir la fila y
  // el valor en ese instante es suficiente para esta primera iteración.
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

function formatKg(kg) {
  if (kg == null) return '—'
  return Number.isInteger(kg)
    ? String(kg)
    : (Math.round(kg * 10) / 10).toString()
}
