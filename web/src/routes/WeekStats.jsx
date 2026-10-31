import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import { useWeeklyStats } from '../lib/useWeeklyStats.js'
import { api } from '../lib/api.js'

/*
  /stats/week — vista detalle de la semana actual.

  Composición: progreso vs. objetivo editable, tres KPIs (sesiones, tiempo,
  volumen) y desglose por grupo muscular (series + volumen + máx peso).

  El objetivo semanal se edita en línea con una pastilla "Editar" que abre un
  pequeño input. Mientras Settings completo no exista, es el único sitio
  donde se puede cambiar la preferencia. Al guardar hace PATCH /api/me/settings
  y refetch del user para que el Home refleje el nuevo denominador.
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
      <header>
        <Link
          to="/home"
          className="text-xs text-text-muted hover:text-text"
        >
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
          {/* Progreso semanal + edición del objetivo */}
          <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                  {t('weekStats.progressKicker')}
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span className="tabular font-display text-3xl font-semibold text-text md:text-4xl">
                    {weekly.sessionCount}
                  </span>
                  <span className="text-sm text-text-muted">
                    / {goal} {t('weekStats.sessionsSuffix')}
                  </span>
                </p>
              </div>
              {!editing ? (
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(goal)
                    setEditing(true)
                    setSaveError(null)
                  }}
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
                    onClick={saveGoal}
                    disabled={saving}
                    className="press rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? t('weekStats.saving') : t('weekStats.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
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

          {/* KPIs semanales */}
          <section className="grid grid-cols-3 gap-3">
            <Kpi
              label={t('weekStats.sessions')}
              value={weekly.sessionCount}
            />
            <Kpi
              label={t('weekStats.time')}
              value={fmtDuration(weekly.totalDurationSec, t)}
              small
            />
            <Kpi
              label={t('weekStats.volume')}
              value={
                weekly.totalVolume > 0 ? fmtNumber(weekly.totalVolume) : '—'
              }
              suffix={weekly.totalVolume > 0 ? 'kg' : null}
              small
            />
          </section>

          {/* Desglose por grupo muscular */}
          {weekly.byMuscle.length === 0 ? (
            <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
              <p className="font-display text-sm font-semibold text-text">
                {t('weekStats.emptyTitle')}
              </p>
              <p className="text-xs text-text-muted">
                {t('weekStats.emptySub')}
              </p>
            </div>
          ) : (
            <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
                {t('weekStats.byMuscleTitle')}
              </h2>
              <ul className="flex flex-col gap-1.5">
                {weekly.byMuscle.map((m) => (
                  <li
                    key={m.muscle}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-3 rounded-card bg-surface-2 px-3 py-2.5"
                  >
                    <span className="truncate text-sm font-medium text-text">
                      {t(`catalog.muscles.${m.muscle}`, {
                        defaultValue: m.muscle,
                      })}
                    </span>
                    <span className="tabular flex items-baseline gap-3 text-xs text-text-muted">
                      <span>
                        {t('training.stats.setsCount', { count: m.sets })}
                      </span>
                      {m.volume > 0 && (
                        <span className="text-text">
                          {fmtNumber(m.volume)} kg
                        </span>
                      )}
                      {m.maxWeight > 0 && (
                        <span>
                          {t('weekStats.maxShort', { kg: m.maxWeight })}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
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
