import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import { useWeeklyStats, breakdownForSession } from '../lib/useWeeklyStats.js'
import { api } from '../lib/api.js'
import ConfirmModal from '../components/routines/ConfirmModal.jsx'

/*
  /stats/week — vista detalle de la semana actual.

  Composición (iteración actual, pedida por el usuario):
    1. Progress card (objetivo editable).
    2. Lista de sesiones. Cada sesión es colapsable; al desplegar muestra:
       - Chips de grupos trabajados (primarios con verde, secundarios en
         gris para que la jerarquía se lea de un vistazo).
       - Lista de ejercicios con sus series completadas (pills peso×reps).
       - Botón borrar sesión.

  La agregación por-músculo (ex-sección "By muscle group") se eliminó: la
  misma información vive ahora dentro de cada sesión expandida.
*/

const DEFAULT_GOAL = 4

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-24 animate-pulse rounded-container bg-surface-2" />
      <div className="h-20 animate-pulse rounded-container bg-surface-2" />
      <div className="h-20 animate-pulse rounded-container bg-surface-2" />
    </div>
  )
}

function fmtDuration(seconds, t) {
  if (!seconds) return t('weekStats.inProgress')
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
  const [openSession, setOpenSession] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

          {weekly.sessions.length === 0 ? (
            <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
              <p className="font-display text-sm font-semibold text-text">
                {t('weekStats.emptyTitle')}
              </p>
              <p className="text-xs text-text-muted">{t('weekStats.emptySub')}</p>
            </div>
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="px-1 font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t('weekStats.sessionsTitle')}
              </h2>
              <ul className="flex flex-col gap-3">
                {weekly.sessions.map(({ summary, detail }) => (
                  <SessionCard
                    key={summary._id}
                    summary={summary}
                    detail={detail}
                    isOpen={openSession === summary._id}
                    onToggle={() =>
                      setOpenSession((cur) =>
                        cur === summary._id ? null : summary._id,
                      )
                    }
                    onDelete={() => setSessionToDelete(summary)}
                    locale={i18n.language}
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
  Card de sesión. Cabecera siempre visible (fecha, rutina, duración, borrar);
  al expandir aparece una zona interna con bg más oscuro (bg-bg/50) que
  marca "detalle" sin añadir border. Dentro: chips de músculos + lista de
  ejercicios con pills de series completadas.
*/
function SessionCard({ summary, detail, isOpen, onToggle, onDelete, locale }) {
  const { t } = useTranslation()
  const date = new Date(summary.startedAt)
  const breakdown = breakdownForSession(detail)
  const title = summary.routineName ?? t('training.resumeSubFree')
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(date)
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return (
    <li className="card-liquid overflow-hidden rounded-container">
      <div className="flex items-center gap-3 px-3 py-3 md:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="press flex min-w-0 flex-1 items-center gap-3 text-left transition-[filter,transform]"
        >
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
            <p className="truncate text-sm font-semibold text-text">{title}</p>
            <p className="tabular mt-0.5 text-xs text-text-muted">
              {dateLabel} · {timeLabel} · {fmtDuration(summary.durationSec, t)}
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
      </div>

      {isOpen && (
        <div className="flex flex-col gap-4 bg-bg/50 px-3 pb-4 pt-3 md:px-4">
          {breakdown.exercises.length === 0 ? (
            <p className="text-xs text-text-muted">
              {t('weekStats.sessionEmpty')}
            </p>
          ) : (
            <>
              <MuscleChips
                primary={breakdown.primaryMuscles}
                secondary={breakdown.secondaryMuscles}
              />
              <ul className="flex flex-col gap-2">
                {breakdown.exercises.map((ex, i) => (
                  <li
                    key={`${ex.name}-${i}`}
                    className="rounded-card bg-surface-2 px-3 py-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium text-text">
                        {ex.name}
                      </p>
                      <p className="tabular shrink-0 text-xs text-text-muted">
                        {t('training.stats.setsCount', { count: ex.sets.length })}
                      </p>
                    </div>
                    {ex.sets.length > 0 && (
                      <ul className="tabular mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-text-muted">
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
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function MuscleChips({ primary, secondary }) {
  const { t } = useTranslation()
  if (primary.length === 0 && secondary.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {t('weekStats.musclesTitle')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {primary.map((m) => (
          <span
            key={`p-${m}`}
            className="inline-flex items-center rounded-pill bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent"
          >
            {t(`catalog.muscles.${m}`, { defaultValue: m })}
          </span>
        ))}
        {secondary.map((m) => (
          <span
            key={`s-${m}`}
            className="inline-flex items-center gap-1 rounded-pill border border-border/60 bg-surface px-2.5 py-0.5 text-[11px] text-text-muted"
            title={t('weekStats.secondaryTitle')}
          >
            {t(`catalog.muscles.${m}`, { defaultValue: m })}
            <span className="text-[9px] uppercase tracking-wider">
              {t('weekStats.secondaryTag')}
            </span>
          </span>
        ))}
      </div>
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
