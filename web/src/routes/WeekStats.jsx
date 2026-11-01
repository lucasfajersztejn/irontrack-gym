import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import { useWeeklyStats } from '../lib/useWeeklyStats.js'
import { api } from '../lib/api.js'
import ConfirmModal from '../components/routines/ConfirmModal.jsx'

/*
  /stats/week — vista detalle de la semana actual.

  Secciones:
  - Progreso vs. objetivo (editable in-line con PATCH /api/me/settings).
  - Tres KPIs: sesiones, tiempo total, volumen total.
  - Desglose por grupo muscular (expandible single-select: abrir uno cierra
    el otro, para no empapar la pantalla). Cada expansión muestra los
    ejercicios que tocaron ese músculo con sus series completadas y pesos.
  - Lista de sesiones de la semana con botón borrar (recuperación si creas
    sesión por accidente). Delete pasa por confirm porque es irreversible.

  Los secundarios cuentan en "series" pero no en volumen ni máx (ver
  useWeeklyStats). El rótulo "secundario" lo infiere la UI cuando el músculo
  tiene series pero volumen=0.
*/

const DEFAULT_GOAL = 4

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-container bg-surface-2" />
      <div className="h-32 animate-pulse rounded-container bg-surface-2" />
      <div className="h-48 animate-pulse rounded-container bg-surface-2" />
    </div>
  )
}

function fmtDuration(seconds, t) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return t('weekStats.hoursMinutes', { h, m })
  return t('weekStats.minutes', { m })
}

export default function WeekStats() {
  const { t, i18n } = useTranslation()
  const { user, refetch: refetchUser } = useUser()
  const weekly = useWeeklyStats()
  const goal = user?.settings?.weeklyGoal ?? DEFAULT_GOAL
  const [editing, setEditing] = useState(false)
  const [goalDraft, setGoalDraft] = useState(goal)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [openMuscle, setOpenMuscle] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fmtNumber = (n) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(n)

  const progressPct = Math.min(100, (weekly.sessionCount / goal) * 100)

  async function saveGoal() {
    const value = Number(goalDraft)
    if (!Number.isFinite(value) || value < 1 || value > 14) {
      setSaveError(new Error(t('weekStats.goalRange')))
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      await api('/api/me/settings', {
        method: 'PATCH',
        body: { weeklyGoal: value },
      })
      await refetchUser()
      setEditing(false)
    } catch (err) {
      setSaveError(err)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!sessionToDelete) return
    setDeleting(true)
    try {
      await api(`/api/sessions/${sessionToDelete._id}`, { method: 'DELETE' })
      await weekly.refetch()
      setSessionToDelete(null)
    } catch (err) {
      setSaveError(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
      <header>
        <Link to="/home" className="text-xs text-text-muted hover:text-text">
          ← {t('weekStats.back')}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
          {t('weekStats.title')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t('weekStats.sinceMonday', {
            date: new Intl.DateTimeFormat(i18n.language, {
              day: '2-digit',
              month: 'long',
            }).format(weekly.monday),
          })}
        </p>
      </header>

      {weekly.loading ? (
        <Skeleton />
      ) : (
        <>
          <ProgressCard
            goal={goal}
            progressPct={progressPct}
            sessionCount={weekly.sessionCount}
            editing={editing}
            goalDraft={goalDraft}
            setGoalDraft={setGoalDraft}
            onEdit={() => {
              setGoalDraft(goal)
              setEditing(true)
              setSaveError(null)
            }}
            onCancel={() => setEditing(false)}
            onSave={saveGoal}
            saving={saving}
            saveError={saveError}
          />

          <section className="grid grid-cols-3 gap-3">
            <Kpi label={t('weekStats.sessions')} value={weekly.sessionCount} />
            <Kpi
              label={t('weekStats.time')}
              value={fmtDuration(weekly.totalDurationSec, t)}
              small
            />
            <Kpi
              label={t('weekStats.volume')}
              value={weekly.totalVolume > 0 ? fmtNumber(weekly.totalVolume) : '—'}
              suffix={weekly.totalVolume > 0 ? 'kg' : null}
              small
            />
          </section>

          {weekly.byMuscle.length === 0 ? (
            <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
              <p className="font-display text-sm font-semibold text-text">
                {t('weekStats.emptyTitle')}
              </p>
              <p className="text-xs text-text-muted">{t('weekStats.emptySub')}</p>
            </div>
          ) : (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t('weekStats.byMuscleTitle')}
              </h2>
              <ul className="flex flex-col gap-2">
                {weekly.byMuscle.map((m) => (
                  <MuscleRow
                    key={m.muscle}
                    muscle={m}
                    isOpen={openMuscle === m.muscle}
                    onToggle={() =>
                      setOpenMuscle((cur) => (cur === m.muscle ? null : m.muscle))
                    }
                    fmtNumber={fmtNumber}
                  />
                ))}
              </ul>
            </section>
          )}

          {weekly.summaries.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="px-1 font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t('weekStats.sessionsTitle')}
              </h2>
              <ul className="flex flex-col gap-2">
                {weekly.summaries.map((s) => (
                  <SessionRow
                    key={s._id}
                    session={s}
                    onDelete={() => setSessionToDelete(s)}
                    locale={i18n.language}
                    t={t}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmModal
        open={Boolean(sessionToDelete)}
        title={t('weekStats.confirmDeleteTitle')}
        description={t('weekStats.confirmDeleteSub')}
        confirmLabel={deleting ? t('weekStats.deleting') : t('weekStats.delete')}
        onConfirm={confirmDelete}
        onCancel={() => setSessionToDelete(null)}
      />
    </div>
  )
}

function ProgressCard({
  goal,
  progressPct,
  sessionCount,
  editing,
  goalDraft,
  setGoalDraft,
  onEdit,
  onCancel,
  onSave,
  saving,
  saveError,
}) {
  const { t } = useTranslation()
  return (
    <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('weekStats.progressKicker')}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tabular font-display text-3xl font-semibold text-text md:text-4xl">
              {sessionCount}
            </span>
            <span className="text-sm text-text-muted">
              / {goal} {t('weekStats.sessionsSuffix')}
            </span>
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="press rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
          >
            {t('weekStats.editGoal')}
          </button>
        ) : (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                {t('weekStats.goalLabel')}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={14}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="tabular w-16 rounded-control border border-border bg-bg px-2 py-1.5 text-center text-sm text-text focus:border-accent focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="press rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? t('weekStats.saving') : t('weekStats.save')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="press rounded-control border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
            >
              {t('weekStats.cancel')}
            </button>
          </div>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {saveError && (
        <p className="text-xs text-error">
          {saveError.payload?.message ??
            saveError.message ??
            t('weekStats.saveErrorGeneric')}
        </p>
      )}
    </section>
  )
}

/*
  Fila de músculo expandible. En reposo es una card autónoma (card-liquid)
  con cabecera clicable; al expandir despliega los ejercicios asociados en
  una zona interna con bg más oscuro para delimitar visualmente la
  separación entre "resumen" y "detalle". Separación generosa entre filas
  (gap-2) + sombra propia por card las aísla sin recurrir a bordes de 1 px.
*/
function MuscleRow({ muscle, isOpen, onToggle, fmtNumber }) {
  const { t } = useTranslation()
  const isSecondaryOnly = muscle.volume === 0

  return (
    <li className="card-liquid overflow-hidden rounded-container">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="press flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-[filter,transform,background-color] hover:bg-surface-2 md:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">
            {t(`catalog.muscles.${muscle.muscle}`, { defaultValue: muscle.muscle })}
            {isSecondaryOnly && (
              <span className="ml-2 text-[10px] font-normal uppercase tracking-wider text-text-muted">
                {t('weekStats.secondaryTag')}
              </span>
            )}
          </p>
          <p className="tabular mt-0.5 flex flex-wrap items-baseline gap-3 text-xs text-text-muted">
            <span>{t('training.stats.setsCount', { count: muscle.sets })}</span>
            {muscle.volume > 0 && (
              <span className="text-text">{fmtNumber(muscle.volume)} kg</span>
            )}
            {muscle.maxWeight > 0 && (
              <span>{t('weekStats.maxShort', { kg: muscle.maxWeight })}</span>
            )}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2 bg-bg/50 px-4 pb-4 pt-1 md:px-5">
          {muscle.exercises.map((ex) => (
            <ExerciseBreakdown key={ex.name} exercise={ex} fmtNumber={fmtNumber} />
          ))}
        </div>
      )}
    </li>
  )
}

function ExerciseBreakdown({ exercise, fmtNumber }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-card bg-surface-2 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-medium text-text">{exercise.name}</p>
        <p className="tabular shrink-0 text-xs text-text-muted">
          {t('training.stats.setsCount', { count: exercise.sets })}
          {exercise.volume > 0 && (
            <span className="ml-2 text-text">{fmtNumber(exercise.volume)} kg</span>
          )}
        </p>
      </div>
      {exercise.details.length > 0 && (
        <ul className="tabular mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-text-muted">
          {exercise.details.map((d, i) => (
            <li
              key={i}
              className="rounded-pill border border-border bg-bg px-2 py-0.5"
            >
              {formatDetail(d, exercise.tracking)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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

function SessionRow({ session, onDelete, locale, t }) {
  const date = new Date(session.startedAt)
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date)
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  const subtitle = session.routineName ?? t('training.resumeSubFree')
  const duration = session.durationSec
    ? session.durationSec >= 3600
      ? t('weekStats.hoursMinutes', {
          h: Math.floor(session.durationSec / 3600),
          m: Math.round((session.durationSec % 3600) / 60),
        })
      : t('weekStats.minutes', { m: Math.round(session.durationSec / 60) })
    : t('weekStats.inProgress')

  return (
    <li className="card-liquid flex items-center gap-3 rounded-container px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-control bg-bg text-center">
        <span className="tabular font-display text-sm font-semibold leading-none text-text">
          {String(date.getDate()).padStart(2, '0')}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-text-muted">
          {new Intl.DateTimeFormat(locale, { month: 'short' })
            .format(date)
            .replace('.', '')}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{subtitle}</p>
        <p className="tabular mt-0.5 text-xs text-text-muted">
          {dateLabel} · {timeLabel} · {duration}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={t('weekStats.deleteAria')}
        className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color] hover:text-error"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
        </svg>
      </button>
    </li>
  )
}

function Kpi({ label, value, suffix, small = false }) {
  return (
    <div className="card-liquid flex flex-col gap-1 rounded-container p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className={`tabular font-display font-semibold leading-none text-text ${small ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}`}
        >
          {value}
        </span>
        {suffix && <span className="text-xs text-text-muted">{suffix}</span>}
      </span>
    </div>
  )
}
