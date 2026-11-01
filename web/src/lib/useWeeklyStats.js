import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/*
  Agregados de la semana actual (ISO: lunes → ahora).

  Dos pasadas al backend:
  1. GET /api/sessions?from=<lunes> para la lista summary (sin entries).
  2. Un detail por cada sesión listada — getSession ahora populate
     `entries.exercise`, así que recibimos secondaryMuscles para desglose.
     Normal son 3–7 sesiones semanales; paralelizar con Promise.all es OK.
     Si crece mucho consideramos endpoint agregado dedicado.

  Si falla alguna fetch de detalle, la ignoramos (no bloquea la vista) y
  los agregados cuentan lo que sí se trajo.

  Reglas de agregación:
  - Músculo primario: cuenta series + volumen + peso máx + lista de ejercicios.
  - Músculos secundarios (si vienen populados): cuentan SOLO series y la
    referencia al ejercicio. Volumen y peso máx no se atribuyen porque el
    secundario no soporta la carga completa — mezclarlo falsearía el "máx
    peso de pecho" al contar un remo (dorsal con pecho secundario).
*/

function mondayOfCurrentWeek(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const isoDay = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - isoDay)
  return d
}

function ensureMuscleBucket(map, muscle) {
  if (!map.has(muscle)) {
    map.set(muscle, {
      muscle,
      sets: 0,
      volume: 0,
      maxWeight: 0,
      exercises: new Map(),
    })
  }
  return map.get(muscle)
}

function ensureExerciseBucket(muscleBucket, exerciseName, tracking) {
  if (!muscleBucket.exercises.has(exerciseName)) {
    muscleBucket.exercises.set(exerciseName, {
      name: exerciseName,
      tracking,
      sets: 0,
      volume: 0,
      maxWeight: 0,
      details: [], // {weightKg, reps, durationSec, distanceM} por serie completada
    })
  }
  return muscleBucket.exercises.get(exerciseName)
}

function aggregate(details) {
  let totalDurationSec = 0
  let totalVolume = 0
  let totalCompletedSets = 0
  const byMuscle = new Map()

  for (const s of details) {
    if (!s) continue
    if (s.durationSec) totalDurationSec += s.durationSec

    for (const e of s.entries ?? []) {
      const completedSets = (e.sets ?? []).filter((set) => set.completed)
      if (completedSets.length === 0) continue

      const primary = e.muscle
      const secondaries =
        (e.exercise && typeof e.exercise === 'object' && e.exercise.secondaryMuscles) || []
      const detailsPerSet = completedSets.map((set) => ({
        weightKg: set.weightKg ?? null,
        reps: set.reps ?? null,
        durationSec: set.durationSec ?? null,
        distanceM: set.distanceM ?? null,
      }))

      // Primary: contribución completa.
      const pBucket = ensureMuscleBucket(byMuscle, primary)
      pBucket.sets += completedSets.length
      const pEx = ensureExerciseBucket(pBucket, e.exerciseName, e.tracking)
      pEx.sets += completedSets.length
      pEx.details.push(...detailsPerSet)

      totalCompletedSets += completedSets.length

      for (const set of completedSets) {
        if (e.tracking === 'weight_reps' && set.weightKg != null && set.reps != null) {
          const vol = set.weightKg * set.reps
          totalVolume += vol
          pBucket.volume += vol
          pEx.volume += vol
          if (set.weightKg > pBucket.maxWeight) pBucket.maxWeight = set.weightKg
          if (set.weightKg > pEx.maxWeight) pEx.maxWeight = set.weightKg
        }
      }

      // Secundarios: solo series + referencia. No sumamos volumen ni max.
      for (const sec of secondaries) {
        if (sec === primary) continue
        const sBucket = ensureMuscleBucket(byMuscle, sec)
        sBucket.sets += completedSets.length
        const sEx = ensureExerciseBucket(sBucket, e.exerciseName, e.tracking)
        sEx.sets += completedSets.length
        sEx.details.push(...detailsPerSet)
      }
    }
  }

  // Serializar los Map a arrays para el consumidor React (los Map re-crean
  // referencia en cada render si los pasas por props directamente).
  const byMuscleArr = Array.from(byMuscle.values())
    .filter((m) => m.sets > 0)
    .map((m) => ({
      ...m,
      exercises: Array.from(m.exercises.values()).sort(
        (a, b) => b.sets - a.sets || b.volume - a.volume,
      ),
    }))
    .sort((a, b) => b.volume - a.volume || b.sets - a.sets)

  return { totalDurationSec, totalVolume, totalCompletedSets, byMuscle: byMuscleArr }
}

export function useWeeklyStats() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    summaries: [],
    details: [],
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const monday = mondayOfCurrentWeek()
      const query = `/api/sessions?limit=50&from=${encodeURIComponent(monday.toISOString())}`
      const summaries = await api(query)
      const details = await Promise.all(
        (Array.isArray(summaries) ? summaries : []).map((s) =>
          api(`/api/sessions/${s._id}`).catch(() => null),
        ),
      )
      setState({
        loading: false,
        error: null,
        summaries,
        details: details.filter(Boolean),
      })
    } catch (err) {
      setState({ loading: false, error: err, summaries: [], details: [] })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await load()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const stats = useMemo(() => aggregate(state.details), [state.details])

  return {
    loading: state.loading,
    error: state.error,
    sessionCount: state.summaries.length,
    monday: mondayOfCurrentWeek(),
    summaries: state.summaries,
    refetch: load,
    ...stats,
  }
}
