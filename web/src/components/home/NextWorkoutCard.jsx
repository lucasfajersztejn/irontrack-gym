// Home card previewing the next routine to train, with a start action.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useRoutine } from '../../lib/useRoutine.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { startSession } from '../../lib/startSession.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { routineMuscles } from '../../lib/exerciseMuscles.js'
import MuscleChips from '../MuscleChips.jsx'
import { PlayIcon } from '../icons/NavIcons.jsx'

const MAX_PREVIEW = 5

function Skeleton() {
  return (
    <div className="card-liquid flex flex-col gap-4 rounded-container p-4 md:p-5">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-2" />
      <div className="h-8 w-48 animate-pulse rounded-card bg-surface-2" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-2" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 w-16 animate-pulse rounded-pill bg-surface-2" />
        <div className="h-5 w-20 animate-pulse rounded-pill bg-surface-2" />
        <div className="h-5 w-14 animate-pulse rounded-pill bg-surface-2" />
      </div>
    </div>
  )
}

export default function NextWorkoutCard({
  routines,
  suggestedRoutine,
  activeSession,
}) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'

  const navigate = useNavigate()
  const selectedRoutineId = useSessionStore((s) => s.selectedRoutineId)
  const setSelectedRoutineId = useSessionStore((s) => s.setSelectedRoutineId)
  const [starting, setStarting] = useState(false)

  const prevSuggestedId = useRef(null)
  useEffect(() => {
    const nextId = suggestedRoutine?._id ?? null
    if (nextId && String(nextId) !== String(prevSuggestedId.current)) {
      setSelectedRoutineId(nextId)
      prevSuggestedId.current = nextId
    }
  }, [suggestedRoutine, setSelectedRoutineId])

  const effectiveId = selectedRoutineId ?? suggestedRoutine?._id ?? null
  const { routine, loading } = useRoutine(effectiveId)

  async function handleStart() {
    if (starting) return
    setStarting(true)
    try {
      await startSession(effectiveId)
    } catch {
      // ignore
    } finally {
      setStarting(false)
      navigate('/training')
    }
  }

  const muscles = useMemo(
    () => (routine ? routineMuscles(routine.exercises ?? []) : { primary: [], secondary: [] }),
    [routine],
  )

  if (!routines?.length) {
    return (
      <div className="card-liquid flex flex-col gap-2 rounded-container p-5">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.nextWorkout')}
        </h2>
        <p className="text-sm text-text-muted">
          {t('home.nextWorkoutEmpty')}
        </p>
      </div>
    )
  }

  if (loading && !routine) return <Skeleton />

  const preview = (routine?.exercises ?? []).slice(0, MAX_PREVIEW)
  const overflow = (routine?.exercises?.length ?? 0) - preview.length

  return (
    <section className="card-liquid flex flex-col gap-4 rounded-container p-4 md:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.nextWorkout')}
        </h2>

        <label className="flex items-center gap-2 text-xs text-text-muted">
          <span className="sr-only">{t('home.pickRoutine')}</span>
          <select
            value={effectiveId ?? ''}
            onChange={(e) => setSelectedRoutineId(e.target.value || null)}
            className="rounded-control border border-border bg-surface px-2 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-2 focus-visible:outline-none"
          >
            {routines.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {activeSession && (
        <p className="rounded-card bg-surface-2 px-3 py-2 text-xs text-text-muted">
          {t('home.activeSessionHint', {
            routine: activeSession.routineName ?? '',
          })}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="truncate font-display text-xl font-semibold tracking-tight text-text md:text-2xl">
            {routine?.name ?? '—'}
          </h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-text">
            {preview.map((e, idx) => (
              <li key={idx} className="flex items-baseline gap-2">
                <span className="font-display text-xs tabular-nums text-text-muted">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="truncate">
                  {resolveExerciseName(e.exercise, user?.exerciseAliases ?? null, lang)}
                </span>
                <span className="ml-auto shrink-0 text-xs text-text-muted tabular-nums">
                  {e.targetSets ?? 3} ×{' '}
                  {e.targetReps ?? e.targetDurationSec ?? '—'}
                </span>
              </li>
            ))}
            {overflow > 0 && (
              <li className="pt-1 text-xs text-text-muted">
                {t('home.plusMoreExercises', { count: overflow })}
              </li>
            )}
          </ul>
        </div>

        <MuscleChips
          primary={muscles.primary}
          secondary={muscles.secondary}
        />

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="press flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast transition-[filter,transform] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlayIcon className="h-4 w-4" />
          {t(activeSession ? 'home.resumeCta' : 'home.startCta')}
        </button>
      </div>
    </section>
  )
}
