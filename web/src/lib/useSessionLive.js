import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

/*
  Estado "live" de la sesión activa: toma el documento inicial del backend,
  mantiene el array de entries en local, y persiste con un PATCH debounced
  (500 ms de inactividad) a /api/sessions/:id.

  Reglas:
  - El backend reemplaza `entries` ENTERO en el PATCH (ver sessionController),
    así que cada mutación local vuelve a enviar el array completo.
  - El modelo valida series por tracking (weight_reps requiere weightKg+reps,
    time requiere durationSec, etc.). Para no 400 en cada tecla, filtramos
    SOLO las series completas al armar el payload. Las series incompletas
    viven en estado local hasta que el usuario rellene los campos; en el
    recarga reaparecen las que ya se sincronizaron.
  - Token de carrera: si un PATCH tarda y mientras llega otra mutación,
    solo el último "gana" el status para no mostrar "guardado" sobre un
    cambio aún en vuelo.
*/

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
    notes: e.notes ?? '',
    sets: (e.sets ?? []).map((s) => ({ ...s })),
  }))
}

function toApiEntries(entries) {
  return entries.map((e, i) => {
    // exercise puede venir como ObjectId string (sesión creada), como objeto
    // populado si el backend hubiera hecho populate (hoy no), o como objeto
    // completo cuando lo añadimos nosotros desde el picker.
    const exerciseId = typeof e.exercise === 'string' ? e.exercise : e.exercise?._id
    return {
      exercise: exerciseId,
      exerciseName: e.exerciseName,
      muscle: e.muscle,
      tracking: e.tracking,
      order: i,
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
  if (s.rpe != null) out.rpe = s.rpe
  if (s.restSec != null) out.restSec = s.restSec
  return out
}

export function useSessionLive(initialSession) {
  const [entries, setEntries] = useState(() => normalize(initialSession))
  const [status, setStatus] = useState('idle') // idle | saving | saved | error
  const sessionIdRef = useRef(initialSession?._id)
  const timerRef = useRef(null)
  const tokenRef = useRef(0)
  const firstRef = useRef(true)

  // Debounce PATCH tras cada cambio de entries. Primer render se salta: no
  // tiene sentido re-enviar lo que acabamos de recibir del backend.
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
      try {
        await api(`/api/sessions/${sessionIdRef.current}`, {
          method: 'PATCH',
          body: { entries: toApiEntries(entries) },
        })
        if (myToken === tokenRef.current) setStatus('saved')
      } catch {
        if (myToken === tokenRef.current) setStatus('error')
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [entries])

  const updateEntry = (i, patch) =>
    setEntries((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  const removeEntry = (i) => setEntries((es) => es.filter((_, j) => j !== i))

  const addEntry = (exercise) => {
    // Copia los campos denormalizados del catálogo. Si en el futuro el
    // ejercicio se renombra o se borra, el nombre y el músculo congelados
    // aquí siguen pintando el historial (mismo contrato que el createSession
    // del backend al cargar una rutina).
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
        notes: '',
        sets: [],
      },
    ])
  }

  const addSet = (entryIndex) =>
    setEntries((es) =>
      es.map((e, j) => {
        if (j !== entryIndex) return e
        // Prefill: copiar los valores de la última serie para acelerar el
        // registro ("Hevy pattern"). Reps/weight normalmente se mantienen o
        // bajan en la siguiente; copiar es un buen default. completed=false
        // porque es una serie nueva.
        const last = e.sets[e.sets.length - 1]
        const seed = last
          ? {
              weightKg: last.weightKg ?? null,
              reps: last.reps ?? null,
              addedWeightKg: last.addedWeightKg ?? null,
              durationSec: last.durationSec ?? null,
              distanceM: last.distanceM ?? null,
            }
          : {}
        return {
          ...e,
          sets: [...e.sets, { ...seed, completed: false }],
        }
      }),
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

  // setEntries plano para transformaciones de bloque (p. ej. agrupar /
  // desagrupar superserie con las utilidades de lib/supersets.js). Es la
  // misma API que un useState, así que el caller puede pasar un reducer.
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
