import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { enqueueSessionPatch } from './offlineQueue.js'

// Live session state with debounced PATCH autosave.

const DEBOUNCE_MS = 500

const REQUIRED_SET_FIELDS = {
  weight_reps: ['weightKg', 'reps'],
  reps: ['reps'],
  time: ['durationSec'],
  distance_time: ['distanceM', 'durationSec'],
}

export function isSetComplete(set, tracking) {
  const required = REQUIRED_SET_FIELDS[tracking] || []
  return required.every((f) => set[f] != null && !Number.isNaN(set[f]))
}

function normalize(session) {
  return (session?.entries ?? []).map((e) => ({
    exercise: e.exercise,
    exerciseName: e.exerciseName,
    muscle: e.muscle,
    tracking: e.tracking,
    order: e.order,
    groupId: e.groupId ?? null,
    barWeightKg: e.barWeightKg ?? null,
    notes: e.notes ?? '',
    sets: (e.sets ?? []).map((s) => ({ ...s })),
    plannedSets: e.plannedSets ?? null,
  }))
}

function toApiEntries(entries) {
  return entries.map((e, i) => {
    const exerciseId = typeof e.exercise === 'string' ? e.exercise : e.exercise?._id
    return {
      exercise: exerciseId,
      exerciseName: e.exerciseName,
      muscle: e.muscle,
      tracking: e.tracking,
      order: i,
      groupId: e.groupId ?? null,
      barWeightKg: e.barWeightKg ?? null,
      notes: e.notes?.trim() || undefined,
      sets: e.sets
        .filter((s) => isSetComplete(s, e.tracking))
        .map((s, j) => cleanSet(s, j)),
    }
  })
}

function cleanSet(s, order) {
  const out = { order, completed: Boolean(s.completed) }
  if (s.weightKg != null) out.weightKg = s.weightKg
  if (s.reps != null) out.reps = s.reps
  if (s.addedWeightKg != null) out.addedWeightKg = s.addedWeightKg
  if (s.durationSec != null) out.durationSec = s.durationSec
  if (s.distanceM != null) out.distanceM = s.distanceM
  if (s.rir != null) out.rir = s.rir
  if (s.restSec != null) out.restSec = s.restSec
  return out
}

export function useSessionLive(initialSession) {
  const [entries, setEntries] = useState(() => normalize(initialSession))
  const [status, setStatus] = useState('idle')
  const sessionIdRef = useRef(initialSession?._id)
  const timerRef = useRef(null)
  const tokenRef = useRef(0)
  const firstRef = useRef(true)

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    if (!sessionIdRef.current) return
    clearTimeout(timerRef.current)
    setStatus('saving')
    timerRef.current = setTimeout(async () => {
      const myToken = ++tokenRef.current
      const body = { entries: toApiEntries(entries) }
      try {
        await api(`/api/sessions/${sessionIdRef.current}`, {
          method: 'PATCH',
          body,
        })
        if (myToken === tokenRef.current) setStatus('saved')
      } catch (err) {
        if (err?.status == null) {
          await enqueueSessionPatch(sessionIdRef.current, body)
          if (myToken === tokenRef.current) setStatus('queued')
        } else if (myToken === tokenRef.current) {
          setStatus('error')
        }
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [entries])

  const updateEntry = (i, patch) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  const removeEntry = (i) => setEntries((es) => es.filter((_, j) => j !== i))

  const addEntry = (exercise) => {
    const name =
      exercise.name?.es || exercise.name?.en || exercise.exerciseName || 'Ejercicio'
    setEntries((es) => [
      ...es,
      {
        exercise,
        exerciseName: name,
        muscle: exercise.muscle,
        tracking: exercise.tracking,
        order: es.length,
        groupId: null,
        notes: '',
        sets: [],
      },
    ])
  }

  const addSet = (entryIndex) =>
    setEntries((es) =>
      es.map((e, j) =>
        j === entryIndex
          ? { ...e, sets: [...e.sets, { completed: false }] }
          : e,
      ),
    )

  const updateSet = (entryIndex, setIndex, patch) =>
    setEntries((es) =>
      es.map((e, j) => {
        if (j !== entryIndex) return e
        return {
          ...e,
          sets: e.sets.map((s, k) => (k === setIndex ? { ...s, ...patch } : s)),
        }
      }),
    )

  const removeSet = (entryIndex, setIndex) =>
    setEntries((es) =>
      es.map((e, j) => {
        if (j !== entryIndex) return e
        return { ...e, sets: e.sets.filter((_, k) => k !== setIndex) }
      }),
    )

  return {
    entries,
    status,
    updateEntry,
    removeEntry,
    addEntry,
    addSet,
    updateSet,
    removeSet,
    setEntries,
  }
}
