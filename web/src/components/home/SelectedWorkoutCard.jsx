import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { useSessionDetail } from '../../lib/useSessionDetail.js'
import { useExerciseProgress } from '../../lib/useExerciseProgress.js'
import { breakdownForSession } from '../../lib/useWeeklyStats.js'
import ExerciseCurve from '../stats/ExerciseCurve.jsx'
import MuscleChips from '../MuscleChips.jsx'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'

/*
  "Detalle de entreno" — tercera card de rendimiento del Home.

  Elige una sesión del histórico reciente y expande TODOS sus ejercicios
  con la curva evolutiva (12w / año / todo) de cada uno. El objetivo es
  distinto a la fila colapsable de WeekDashboard, que sirve para revisar
  "esta semana" sesión a sesión; aquí la lectura es "tómate un entreno
  y mira cómo va cada ejercicio en el horizonte que elijas".

  Detección de PR del día:
    Sobre los puntos históricos del ejercicio buscamos el que coincide con
    la sesión elegida (`sessionId`). Si su `best1RM` o `heaviestKg` superan
    todos los anteriores en fecha, pintamos badge. Priorizamos 1RM porque
    es la métrica que la app ya destaca en el resto del dashboard; si no
    hubo 1RM nuevo pero sí peso máx, mostramos peso máx como fallback.

  Fetches:
    - Session detail al cambiar de sesión (`useSessionDetail`).
    - Progress por ejercicio en paralelo (`useExerciseProgress`). N fetches
      pero N es el número de ejercicios con `weight_reps` + id en catálogo
      de UNA sesión (≤10 habitual). No merece la pena pooling.
*/

const RANGES = ['12w', 'year', 'all']
const MAX_RECENT = 20

function formatDetail(d, tracking) {
  switch (tracking) {
    case 'weight_reps':
      if (d.weightKg != null && d.reps != null) return `${d.weightKg} × ${d.reps}`
      return '—'
    case 'reps':
      return d.reps != null ? `× ${d.reps}` : '—'
    case 'time':
      return d.durationSec != null ? `${d.durationSec} s` : '—'
    case 'distance_time':
      return d.distanceM != null && d.durationSec != null
        ? `${d.distanceM} m · ${d.durationSec} s`
        : '—'
    default:
      return '—'
  }
}

function formatSessionLabel(s, locale) {
  const date = new Date(s.startedAt)
  const dd = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
  return s.routineName ? `${dd} · ${s.routineName}` : dd
}

/*
  Fila por ejercicio dentro de la card.
  - Con `weight_reps` + id → series pills + ExerciseCurve con la fecha del
    día resaltada y badge PR si corresponde.
  - Sin curva posible → series pills y nota corta.
*/
function ExerciseBlock({ ex, range, sessionDate, sessionId, aliases, lang }) {
  const { t } = useTranslation()
  const expandable = ex.tracking === 'weight_reps' && !!ex.exerciseId
  const { points } = useExerciseProgress(ex.exerciseId, expandable)
  const name = resolveExerciseName(ex, aliases, lang)

  // PR del día: punto del histórico cuyo sessionId coincide con la sesión
  // actual + sus máximos superan todo lo anterior en fecha.
  const prKind = useMemo(() => {
    if (!expandable || !points || points.length === 0) return null
    const current = points.find((p) => p.sessionId === sessionId)
    if (!current) return null
    const target = new Date(current.date).getTime()
    let maxWeight = 0
    let maxOneRm = 0
    for (const p of points) {
      const t = new Date(p.date).getTime()
      if (t >= target) continue
      if (p.heaviestKg > maxWeight) maxWeight = p.heaviestKg
      if (p.best1RM > maxOneRm) maxOneRm = p.best1RM
    }
    if (current.best1RM > maxOneRm) return '1rm'
    if (current.heaviestKg > maxWeight) return 'heaviest'
    return null
  }, [expandable, points, sessionId])

  return (
    <li className="rounded-card bg-surface-2">
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
        <p className="min-w-0 truncate text-sm font-medium text-text">{name}</p>
        {prKind && (
          <span className="shrink-0 rounded-pill bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            {t('home.prTag')}
          </span>
        )}
      </div>

      {ex.sets.length > 0 && (
        <ul className="tabular flex flex-wrap gap-1.5 px-3 pt-2 text-[11px] text-text-muted">
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

      {expandable && points && (
        <div className="border-t border-border/60 px-3 py-3 mt-3">
          <ExerciseCurve
            points={points}
            range={range}
            highlightDate={sessionDate}
          />
        </div>
      )}
    </li>
  )
}

export default function SelectedWorkoutCard({ sessions = [], loading }) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const aliases = user?.exerciseAliases ?? null

  const recent = useMemo(() => {
    return sessions
      .filter((s) => s.endedAt || s.durationEstimated) // excluye activa sin cerrar
      .slice(0, MAX_RECENT)
  }, [sessions])

  const [selectedId, setSelectedId] = useState(null)
  const [range, setRange] = useState('12w')
  // Colapsado por defecto: esta card expande una ExerciseCurve por cada
  // ejercicio de la sesión, lo que la vuelve el bloque más alto del Home.
  // Cerrada de arranque, Home abre escaneable; al abrirla se montan las
  // filas y recién ahí disparan sus fetches de progreso.
  const [open, setOpen] = useState(false)

  // Mantén la selección sincronizada con la sesión más reciente mientras
  // no la haya cambiado el usuario (o cuando la elegida deja de existir
  // por un borrado). Primer paint sin recent → null; al cargar, apunta
  // a la más nueva.
  useEffect(() => {
    if (recent.length === 0) return
    const stillValid = recent.some((s) => s._id === selectedId)
    // Sincroniza la selección con la sesión más nueva cuando la elegida deja
    // de existir (borrado) o en el primer load. Es el uso legítimo de setState
    // en efecto: reaccionar a un cambio de datos externos, no un bucle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!stillValid) setSelectedId(recent[0]._id)
  }, [recent, selectedId])

  const { detail, loading: loadingDetail } = useSessionDetail(selectedId)
  const breakdown = useMemo(() => breakdownForSession(detail), [detail])

  if (loading) {
    return (
      <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
        <div className="h-4 w-32 animate-pulse rounded-full bg-surface-2" />
        <div className="h-9 w-64 animate-pulse rounded-card bg-surface-2" />
        <div className="h-40 w-full animate-pulse rounded-card bg-surface-2" />
      </section>
    )
  }

  if (recent.length === 0) {
    return (
      <section className="card-liquid flex flex-col gap-2 rounded-container p-5">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.selectedWorkout')}
        </h2>
        <p className="text-sm text-text-muted">{t('home.selectedWorkoutEmpty')}</p>
      </section>
    )
  }

  const sessionDate = detail?.startedAt ?? null

  return (
    <section className="card-liquid flex flex-col gap-4 rounded-container p-4 md:p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex w-full items-center gap-2 text-left transition-[filter,transform,color] hover:text-accent"
      >
        <ChevronRightIcon
          className={`h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.selectedWorkout')}
        </h2>
      </button>

      {open && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="rounded-control border border-border bg-surface px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-none"
            >
              {recent.map((s) => (
                <option key={s._id} value={s._id}>
                  {formatSessionLabel(s, i18n.language)}
                </option>
              ))}
            </select>
          </label>
          <div
            role="radiogroup"
            aria-label={t('home.selectedWorkout')}
            className="flex gap-1 rounded-control border border-border bg-surface p-0.5"
          >
            {RANGES.map((r) => {
              const active = r === range
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRange(r)}
                  className={`press rounded-control px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t(
                    r === '12w'
                      ? 'home.rangeLast12w'
                      : r === 'year'
                        ? 'home.rangeYear'
                        : 'home.rangeAll',
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {open && (loadingDetail && !detail ? (
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-card bg-surface-2" />
          <div className="h-40 w-full animate-pulse rounded-card bg-surface-2" />
        </div>
      ) : breakdown.exercises.length === 0 ? (
        <p className="text-sm text-text-muted">{t('home.selectedWorkoutEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <MuscleChips
            primary={breakdown.primaryMuscles}
            secondary={breakdown.secondaryMuscles}
          />
          <ul className="flex flex-col gap-2">
            {breakdown.exercises.map((ex, i) => (
              <ExerciseBlock
                key={`${ex.exerciseId ?? ex.name}-${i}`}
                ex={ex}
                range={range}
                sessionId={selectedId}
                sessionDate={sessionDate}
                aliases={aliases}
                lang={lang}
              />
            ))}
          </ul>
          {breakdown.exercises.every((ex) => ex.tracking !== 'weight_reps') && (
            <p className="text-xs text-text-muted">
              {t('home.selectedWorkoutNoWeights')}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
