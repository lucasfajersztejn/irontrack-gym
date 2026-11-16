// Live workout view: session header, exercise cards, rest timer, finish/cancel and offline status.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionExerciseCard from './SessionExerciseCard.jsx'
import SessionStatsCard from './SessionStatsCard.jsx'
import RestTimerBar from './RestTimerBar.jsx'
import ExercisePickerSheet from '../routines/ExercisePickerSheet.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import SupersetBlock from '../routines/SupersetBlock.jsx'
import { PRToastStack } from '../ui/PRToast.jsx'
import { useSessionLive } from '../../lib/useSessionLive.js'
import { useExerciseHistory } from '../../lib/useExerciseHistory.js'
import { groupEntries } from '../../lib/supersets.js'
import { REST_DEFAULT_SEC, useSessionStore } from '../../stores/sessionStore.js'
import { useUser } from '../../contexts/UserContext.jsx'
import { useAutoFlush, useOfflineState } from '../../lib/offlineQueue.js'
import { api } from '../../lib/api.js'

export default function SessionLiveView({ session, onFinish, onCancel, finishing, cancelling }) {
  const { t } = useTranslation()
  const {
    entries,
    status,
    updateEntry,
    updateSet,
    removeSet,
    addSet,
    addEntry,
    removeEntry,
    setEntries,
  } = useSessionLive(session)
  const { history, detectPR } = useExerciseHistory(session)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false)
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)
  const stopRest = useSessionStore((s) => s.stopRest)

  const pushToast = (toast) => {
    toastIdRef.current += 1
    setToasts((xs) => [...xs, { id: toastIdRef.current, ...toast }])
  }
  const dismissToast = (id) =>
    setToasts((xs) => xs.filter((t) => t.id !== id))

  const toggleSetCompleteWithPR = (entryIndex, setIndex, completed) => {
    const entry = entries[entryIndex]
    const set = entry?.sets?.[setIndex]
    updateSet(entryIndex, setIndex, { completed })
    if (!entry || !set || !completed || set.completed) return
    const exerciseId =
      typeof entry.exercise === 'string' ? entry.exercise : entry.exercise?._id
    const hit = detectPR(exerciseId, entry.tracking, set)
    if (hit) {
      pushToast({
        exerciseName: entry.exerciseName,
        kind: hit.kind,
        value: hit.value,
      })
    }
  }

  const { user } = useUser()
  const restSec = user?.settings?.restTimerSec ?? REST_DEFAULT_SEC

  useAutoFlush(api)
  const { online, pending } = useOfflineState()

  useEffect(() => stopRest, [stopRest])

  const alreadyIds = entries.map((e) =>
    typeof e.exercise === 'string' ? e.exercise : e.exercise?._id,
  )

  const ungroupBlock = (firstIndex) => {
    setEntries((es) => {
      const gid = es[firstIndex]?.groupId
      if (!gid) return es
      return es.map((e) => (e.groupId === gid ? { ...e, groupId: null } : e))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader
        session={session}
        status={status}
        online={online}
        pending={pending}
      />

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
            <p className="font-display text-sm font-semibold text-text">
              {t('training.liveEmptyTitle')}
            </p>
            <p className="text-xs text-text-muted">
              {t('training.liveEmptySub')}
            </p>
          </div>
        )}
        {groupEntries(entries).map((block, bi) => {
          const isSuperset = block.items.length > 1
          const rows = block.items.map(({ entry, index }) => {
            const exerciseId =
              typeof entry.exercise === 'string'
                ? entry.exercise
                : entry.exercise?._id
            const entryHistory = history[exerciseId] ?? null
            return (
              <SessionExerciseCard
                key={`${exerciseId}-${index}`}
                entry={entry}
                history={entryHistory}
                onAddSet={() => addSet(index)}
                onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
                onUpdateEntry={(patch) => updateEntry(index, patch)}
                onToggleSetComplete={(setIndex, completed) =>
                  toggleSetCompleteWithPR(index, setIndex, completed)
                }
                onRemoveSet={(setIndex) => removeSet(index, setIndex)}
                onRemoveEntry={() => removeEntry(index)}
              />
            )
          })
          if (isSuperset) {
            return (
              <SupersetBlock
                key={block.groupId}
                onUngroup={() => ungroupBlock(block.items[0].index)}
              >
                {rows}
              </SupersetBlock>
            )
          }
          return (
            <div key={`solo-${bi}`} className="flex flex-col gap-2">
              {rows}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="press self-stretch rounded-container border border-dashed border-border bg-surface/40 px-4 py-3 text-sm font-medium text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface hover:text-text"
      >
        + {t('training.addExercise')}
      </button>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setConfirmFinishOpen(true)}
          disabled={finishing || cancelling || !online || pending > 0}
          className="press rounded-control bg-accent px-5 py-3 text-sm font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {finishing ? t('training.finishing') : t('training.finish')}
        </button>
        {(!online || pending > 0) && (
          <p className="self-center text-[11px] text-text-muted">
            {t('training.finishBlockedOffline')}
          </p>
        )}
        {onCancel && (
          <button
            type="button"
            onClick={() => setConfirmCancelOpen(true)}
            disabled={finishing || cancelling}
            className="press self-center rounded-control px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelling ? t('training.cancelling') : t('training.cancel')}
          </button>
        )}
      </div>

      <SessionStatsCard entries={entries} startedAt={session.startedAt} />

      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exercise) => {
          addEntry(exercise)
          setPickerOpen(false)
        }}
        alreadyPickedIds={alreadyIds}
      />

      <ConfirmModal
        open={confirmFinishOpen}
        title={t('training.confirmFinishTitle')}
        description={t('training.confirmFinishSub')}
        confirmLabel={t('training.finish')}
        onConfirm={() => {
          setConfirmFinishOpen(false)
          onFinish()
        }}
        onCancel={() => setConfirmFinishOpen(false)}
        destructive={false}
      />

      <ConfirmModal
        open={confirmCancelOpen}
        title={t('training.confirmCancelTitle')}
        description={t('training.confirmCancelSub')}
        confirmLabel={t('training.cancel')}
        onConfirm={() => {
          setConfirmCancelOpen(false)
          onCancel?.()
        }}
        onCancel={() => setConfirmCancelOpen(false)}
        destructive
      />

      {restSec > 0 && (
        <>
          <div aria-hidden className="h-16 md:h-20" />
          <RestTimerBar restSec={restSec} />
        </>
      )}

      <PRToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

function SessionHeader({ session, status, online, pending }) {
  const { t } = useTranslation()
  const subtitle = session.routineName ?? t('training.resumeSubFree')

  return (
    <header className="card-liquid flex items-center justify-between gap-3 rounded-container p-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-base font-semibold tracking-tight text-text">
          {subtitle}
        </h2>
        <StatusDot status={status} />
      </div>
      {(!online || pending > 0) && (
        <OfflineBadge online={online} pending={pending} />
      )}
    </header>
  )
}

function OfflineBadge({ online, pending }) {
  const { t } = useTranslation()
  const label = !online
    ? pending > 0
      ? t('training.offlineWithPending', { count: pending })
      : t('training.offline')
    : t('training.syncing', { count: pending })
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        online ? 'bg-accent/15 text-accent' : 'bg-surface text-text-muted'
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          online ? 'bg-accent animate-pulse' : 'bg-text-muted'
        }`}
      />
      {label}
    </span>
  )
}

function StatusDot({ status }) {
  const { t } = useTranslation()
  if (status === 'idle') return null
  const map = {
    saving: { label: t('training.saving'), color: 'bg-text-muted' },
    saved: { label: t('training.saved'), color: 'bg-accent' },
    queued: { label: t('training.queued'), color: 'bg-text-muted' },
    error: { label: t('training.saveError'), color: 'bg-error' },
  }
  const { label, color } = map[status] ?? map.saving
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

