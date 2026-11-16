// Routine editor route: create and edit a workout template and its exercises.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ExerciseEditorRow from '../components/routines/ExerciseEditorRow.jsx'
import ExercisePickerSheet from '../components/routines/ExercisePickerSheet.jsx'
import ConfirmModal from '../components/routines/ConfirmModal.jsx'
import MuscleChips from '../components/MuscleChips.jsx'
import SupersetBlock from '../components/routines/SupersetBlock.jsx'
import { useRoutine } from '../lib/useRoutine.js'
import { api } from '../lib/api.js'
import { groupEntries, mergeWithNext, unmergeAt } from '../lib/supersets.js'
import { routineMuscles } from '../lib/exerciseMuscles.js'

const TRACKING_DEFAULTS = {
  weight_reps: { targetSets: 3 },
  reps: { targetSets: 3 },
  time: { targetSets: 3, targetDurationSec: 30 },
  distance_time: { targetDurationSec: 600, targetDistanceM: 1000 },
}

function normalize(routine) {
  if (!routine) return { name: '', description: '', entries: [] }
  return {
    name: routine.name ?? '',
    description: routine.description ?? '',
    entries: (routine.exercises ?? []).map((e) => ({
      exercise: e.exercise,
      targetSets: e.targetSets ?? null,
      targetReps: e.targetReps ?? null,
      targetWeightKg: e.targetWeightKg ?? null,
      targetDurationSec: e.targetDurationSec ?? null,
      targetDistanceM: e.targetDistanceM ?? null,
      barWeightKg: e.barWeightKg ?? null,
      groupId: e.groupId ?? null,
      notes: e.notes ?? '',
    })),
  }
}

function toApiPayload(state) {
  return {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    exercises: state.entries.map((e, index) => ({
      exercise: e.exercise._id,
      order: index,
      targetSets: e.targetSets ?? undefined,
      targetReps: e.targetReps ?? undefined,
      targetWeightKg: e.targetWeightKg ?? undefined,
      targetDurationSec: e.targetDurationSec ?? undefined,
      targetDistanceM: e.targetDistanceM ?? undefined,
      barWeightKg: e.barWeightKg ?? undefined,
      groupId: e.groupId ?? undefined,
      notes: e.notes?.trim() || undefined,
    })),
  }
}

export default function RoutineEditor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id
  const { routine, loading: loadingRoutine, error: fetchError } = useRoutine(id)

  const [state, setState] = useState({ name: '', description: '', entries: [] })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const initialRef = useRef(null)
  useEffect(() => {
    if (!isNew && routine) {
      const normalized = normalize(routine)
      initialRef.current = JSON.stringify(normalized)
      setState(normalized)
    } else if (isNew && initialRef.current === null) {
      initialRef.current = JSON.stringify({ name: '', description: '', entries: [] })
    }
  }, [isNew, routine])

  const isDirty =
    initialRef.current !== null && JSON.stringify(state) !== initialRef.current

  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function requestLeave() {
    if (isDirty) setLeaveOpen(true)
    else navigate('/routines')
  }

  const alreadyIds = useMemo(
    () => state.entries.map((e) => e.exercise._id),
    [state.entries],
  )

  function updateEntry(i, patch) {
    setState((s) => ({
      ...s,
      entries: s.entries.map((e, idx) => (idx === i ? patch : e)),
    }))
  }

  function move(i, dir) {
    setState((s) => {
      const entries = s.entries
      const target = i + dir
      if (target < 0 || target >= entries.length) return s
      const curGid = entries[i].groupId ?? null
      const tgtGid = entries[target].groupId ?? null
      if (curGid && curGid === tgtGid) {
        const next = [...entries]
        ;[next[i], next[target]] = [next[target], next[i]]
        return { ...s, entries: next }
      }
      const blocks = groupEntries(entries)
      const curBi = blocks.findIndex((b) =>
        b.items.some((it) => it.index === i),
      )
      const tgtBi = curBi + (dir > 0 ? 1 : -1)
      if (tgtBi < 0 || tgtBi >= blocks.length) return s
      const reordered = [...blocks]
      ;[reordered[curBi], reordered[tgtBi]] = [reordered[tgtBi], reordered[curBi]]
      const flat = reordered.flatMap((b) => b.items.map((it) => it.entry))
      return { ...s, entries: flat }
    })
  }

  function remove(i) {
    setState((s) => ({ ...s, entries: s.entries.filter((_, idx) => idx !== i) }))
  }

  function groupWithNext(i) {
    setState((s) => ({ ...s, entries: mergeWithNext(s.entries, i) }))
  }
  function ungroup(i) {
    setState((s) => ({ ...s, entries: unmergeAt(s.entries, i) }))
  }

  function addExercise(exercise) {
    const defaults = TRACKING_DEFAULTS[exercise.tracking] ?? {}
    setState((s) => ({
      ...s,
      entries: [
        ...s.entries,
        {
          exercise,
          targetSets: defaults.targetSets ?? null,
          targetReps: defaults.targetReps ?? null,
          targetWeightKg: null,
          targetDurationSec: defaults.targetDurationSec ?? null,
          targetDistanceM: defaults.targetDistanceM ?? null,
          barWeightKg: null,
          groupId: null,
          notes: '',
        },
      ],
    }))
    setPickerOpen(false)
  }

  async function save() {
    setSaveError(null)
    const trimmedName = state.name.trim()
    if (!trimmedName) {
      setSaveError(new Error(t('routines.errors.nameRequired')))
      return
    }
    if (state.entries.length === 0) {
      setSaveError(new Error(t('routines.errors.atLeastOne')))
      return
    }
    setSaving(true)
    try {
      const payload = toApiPayload(state)
      if (isNew) {
        await api('/api/routines', { method: 'POST', body: payload })
      } else {
        await api(`/api/routines/${id}`, { method: 'PATCH', body: payload })
      }
      initialRef.current = JSON.stringify(state)
      navigate('/routines')
    } catch (err) {
      setSaveError(err)
      setSaving(false)
    }
  }

  async function doDelete() {
    try {
      await api(`/api/routines/${id}`, { method: 'DELETE' })
      navigate('/routines')
    } catch (err) {
      setSaveError(err)
      setDeleteOpen(false)
    }
  }

  if (!isNew && loadingRoutine) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="h-10 animate-pulse rounded-card bg-surface-2" />
        <div className="h-32 animate-pulse rounded-container bg-surface-2" />
      </div>
    )
  }

  if (!isNew && fetchError) {
    return (
      <div className="mx-auto max-w-3xl text-center text-text-muted">
        {t('routines.errors.notFound')}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={requestLeave}
            className="text-xs text-text-muted hover:text-text"
          >
            ← {t('routines.backToList')}
          </button>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
            {isNew ? t('routines.newTitle') : t('routines.editTitle')}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-error"
          >
            {t('routines.delete')}
          </button>
        )}
      </header>

      <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('routines.fields.name')}
          </span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            maxLength={60}
            placeholder={t('routines.namePlaceholder')}
            className="rounded-control border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('routines.fields.description')}
          </span>
          <textarea
            value={state.description}
            onChange={(e) =>
              setState((s) => ({ ...s, description: e.target.value }))
            }
            maxLength={500}
            rows={2}
            placeholder={t('routines.descriptionPlaceholder')}
            className="rounded-control border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
        </label>
      </section>

      {state.entries.length > 0 && (() => {
        const { primary, secondary } = routineMuscles(state.entries)
        if (primary.length === 0 && secondary.length === 0) return null
        return (
          <section className="card-liquid rounded-container p-4 md:p-5">
            <MuscleChips primary={primary} secondary={secondary} />
          </section>
        )
      })()}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            {t('routines.exercisesTitle', { count: state.entries.length })}
          </h2>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            + {t('routines.addExercise')}
          </button>
        </div>

        {state.entries.length === 0 ? (
          <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-10 text-center">
            <p className="font-display text-base font-semibold text-text">
              {t('routines.emptyTitle')}
            </p>
            <p className="text-sm text-text-muted">{t('routines.emptySub')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groupEntries(state.entries).map((block, bi, blocks) => {
              const isSuperset = block.items.length > 1
              const lastEntryIndex = block.items[block.items.length - 1].index
              const nextBlock = blocks[bi + 1]
              const canLinkToNext = Boolean(nextBlock)
              const rows = block.items.map(({ entry, index }) => (
                <ExerciseEditorRow
                  key={`${entry.exercise._id}-${index}`}
                  entry={entry}
                  onChange={(patch) => updateEntry(index, patch)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onRemove={() => remove(index)}
                  canMoveUp={index > 0}
                  canMoveDown={index < state.entries.length - 1}
                />
              ))
              return (
                <div
                  key={block.groupId ?? `solo-${bi}`}
                  className="flex flex-col gap-2"
                >
                  {isSuperset ? (
                    <SupersetBlock onUngroup={() => ungroup(block.items[0].index)}>
                      {rows}
                    </SupersetBlock>
                  ) : (
                    rows
                  )}
                  {canLinkToNext && (
                    <button
                      type="button"
                      onClick={() => groupWithNext(lastEntryIndex)}
                      className="press group flex w-full items-center gap-2 py-1 transition-[filter,transform]"
                    >
                      <span
                        aria-hidden
                        className="h-px flex-1 bg-accent/40 transition-colors group-hover:bg-accent/70"
                      />
                      <span className="inline-flex items-center gap-1.5 rounded-pill border border-accent/50 bg-accent/15 px-3 py-1 text-xs font-semibold text-accent transition-colors group-hover:bg-accent/25">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        {t('routines.linkSuperset')}
                      </span>
                      <span
                        aria-hidden
                        className="h-px flex-1 bg-accent/40 transition-colors group-hover:bg-accent/70"
                      />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {saveError && (
        <p className="text-sm text-error">
          {saveError.message ?? t('routines.errors.generic')}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={requestLeave}
          className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          {t('routines.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08] disabled:opacity-60"
        >
          {saving ? t('routines.saving') : t('routines.save')}
        </button>
      </div>

      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        alreadyPickedIds={alreadyIds}
      />
      <ConfirmModal
        open={deleteOpen}
        title={t('routines.confirmDeleteTitle')}
        description={t('routines.confirmDeleteSub')}
        confirmLabel={t('routines.delete')}
        onConfirm={doDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <ConfirmModal
        open={leaveOpen}
        title={t('routines.confirmLeaveTitle')}
        description={t('routines.confirmLeaveSub')}
        confirmLabel={t('routines.leaveAnyway')}
        onConfirm={() => {
          setLeaveOpen(false)
          navigate('/routines')
        }}
        onCancel={() => setLeaveOpen(false)}
        destructive={false}
      />
    </div>
  )
}
