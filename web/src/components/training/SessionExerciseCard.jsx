// Card for one exercise in the live session: its sets, live stats and progression suggestions.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionSetRow from './SessionSetRow.jsx'
import ExerciseHelpSheet from './ExerciseHelpSheet.jsx'
import BarWeightPopover from './BarWeightPopover.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import { useUser } from '../../contexts/UserContext.jsx'
import { barWeightFor, perSideFromTotal } from '../../lib/weight.js'
import { useExerciseName } from '../../lib/exerciseName.js'
import { estimate1RM } from '../../lib/stats.js'
import {
  suggestFirstSetOfDay,
  suggestNextSetInSession,
} from '../../lib/suggestProgression.js'

const PR_TOLERANCE_KG = 0.1

export default function SessionExerciseCard({
  entry,
  history,
  onAddSet,
  onUpdateSet,
  onUpdateEntry,
  onToggleSetComplete,
  onRemoveSet,
  onRemoveEntry,
}) {
  const { t } = useTranslation()
  const { user } = useUser()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const completedCount = entry.sets.filter((s) => s.completed).length

  const liveStats = useMemo(() => {
    if (entry.tracking !== 'weight_reps') return null
    let tonnage = 0
    let best = 0
    for (const s of entry.sets) {
      if (!s.completed) continue
      if (s.weightKg == null || s.reps == null) continue
      tonnage += s.weightKg * s.reps
      const oneRm = estimate1RM(s.weightKg, s.reps)
      if (oneRm > best) best = oneRm
    }
    return { tonnage, best1RM: best }
  }, [entry.sets, entry.tracking])

  const historical1RM = history?.prs?.best1RM ?? 0
  const isPR =
    liveStats != null &&
    liveStats.best1RM > 0 &&
    liveStats.best1RM > historical1RM + PR_TOLERANCE_KG

  const exerciseObj =
    entry.exercise && typeof entry.exercise === 'object' ? entry.exercise : null
  const { name: displayName } = useExerciseName(exerciseObj ?? entry)
  const usesBar = Boolean(exerciseObj?.usesBar)
  const barInputMode = user?.settings?.barInputMode ?? 'plates'
  const suggestProgression = user?.settings?.suggestProgression !== false
  const userBarKg = user?.settings?.defaultBarWeightKg ?? 20
  const barKg = exerciseObj
    ? barWeightFor(exerciseObj, entry.barWeightKg, userBarKg)
    : 0
  const showBarSettings = exerciseObj?.equipment === 'barbell'

  const showPlatesInput =
    entry.tracking === 'weight_reps' && usesBar && barInputMode === 'plates'
  const toDisplayKg = (totalKg) =>
    totalKg == null
      ? null
      : showPlatesInput
        ? perSideFromTotal(totalKg, barKg)
        : totalKg

  return (
    <article className="card-liquid flex flex-col gap-3 rounded-container p-3 md:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight text-text">
            {displayName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              {t(`catalog.muscles.${entry.muscle}`, { defaultValue: entry.muscle })}
            </span>
            <span className="tabular text-[11px] text-text-muted">
              {t('training.setsProgress', {
                done: completedCount,
                total: entry.sets.length,
              })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showBarSettings && (
            <BarWeightPopover
              value={entry.barWeightKg ?? null}
              currentKg={barKg}
              onChange={(nextKg) => onUpdateEntry?.({ barWeightKg: nextKg })}
            />
          )}
          {exerciseObj && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t('training.helpOpen', { name: displayName })}
              className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2M12 17h.01" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={t('training.removeExercise')}
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {liveStats && liveStats.best1RM > 0 && (
        <LiveStatsRow
          tonnage={liveStats.tonnage}
          best1RM={liveStats.best1RM}
          isPR={isPR}
        />
      )}

      {entry.sets.length > 0 && (
        <div className="flex flex-col gap-1">
          <SetListHeader tracking={entry.tracking} />
          {entry.sets.map((set, i) => (
            <SessionSetRow
              key={i}
              index={i}
              set={set}
              tracking={entry.tracking}
              usesBar={usesBar}
              barInputMode={barInputMode}
              barKg={barKg}
              suggestion={suggestionForSet(
                entry,
                history,
                i,
                suggestProgression,
                toDisplayKg,
              )}
              onChange={(patch) => onUpdateSet(i, patch)}
              onToggleComplete={() =>
                onToggleSetComplete(i, !set.completed)
              }
              onDelete={() => onRemoveSet(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onAddSet()}
        className="press self-start rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
      >
        + {t('training.addSet')}
      </button>

      <ConfirmModal
        open={confirmOpen}
        title={t('training.confirmRemoveExerciseTitle', {
          name: displayName,
        })}
        description={t('training.confirmRemoveExerciseSub')}
        confirmLabel={t('training.removeExercise')}
        onConfirm={() => {
          setConfirmOpen(false)
          onRemoveEntry()
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ExerciseHelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        exercise={exerciseObj}
      />
    </article>
  )
}

function LiveStatsRow({ tonnage, best1RM, isPR }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-stretch gap-2 rounded-card bg-surface-2/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
          {t('training.liveStats.tonnage')}
        </p>
        <p className="tabular font-display text-sm font-semibold text-text">
          {Math.round(tonnage)} kg
        </p>
      </div>
      <div className="h-auto w-px bg-border/60" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('training.liveStats.oneRm')}
          </p>
          {isPR && (
            <span
              className="rounded-pill bg-accent/15 px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-accent"
              aria-label={t('training.liveStats.prAria')}
            >
              {t('training.liveStats.pr')}
            </span>
          )}
        </div>
        <p
          className={`tabular font-display text-sm font-semibold ${
            isPR ? 'text-accent' : 'text-text'
          }`}
        >
          {formatKg(best1RM)} kg
        </p>
      </div>
    </div>
  )
}

function formatKg(kg) {
  return Number.isInteger(kg) ? String(kg) : (Math.round(kg * 10) / 10).toString()
}

function SetListHeader({ tracking }) {
  const { t } = useTranslation()
  const labels = (() => {
    switch (tracking) {
      case 'weight_reps':
        return [t('training.setFields.weight'), t('training.setFields.reps')]
      case 'reps':
        return [t('training.setFields.reps')]
      case 'time':
        return [t('training.setFields.duration')]
      case 'distance_time':
        return [t('training.setFields.distance'), t('training.setFields.duration')]
      default:
        return []
    }
  })()
  return (
    <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
      <span className="w-6 shrink-0 text-center">#</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
      <span className="w-9 shrink-0 text-center">✓</span>
      <span className="w-7 shrink-0" />
    </div>
  )
}

function suggestionForSet(entry, history, index, suggestProgression, toDisplay) {
  if (!suggestProgression || entry.tracking !== 'weight_reps') return null

  if (index > 0) {
    const prev = entry.sets[index - 1]
    const next = suggestNextSetInSession({
      lastSet: {
        weightKg: toDisplay(prev?.weightKg),
        reps: prev?.reps ?? null,
        rir: prev?.rir ?? null,
      },
    })
    if (next) return next
  }

  const firstLastTime = history?.lastSession?.sets?.[0] ?? null
  const planned = entry.plannedSets?.[0] ?? null
  return suggestFirstSetOfDay({
    firstSetLastTime: firstLastTime
      ? { weightKg: toDisplay(firstLastTime.weightKg), reps: firstLastTime.reps ?? null }
      : null,
    plannedSet: planned
      ? { weightKg: toDisplay(planned.weightKg), reps: planned.reps ?? null }
      : null,
  })
}
