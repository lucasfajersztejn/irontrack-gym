import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/*
  Vista semanal: devolvemos las sesiones de la semana actual (lunes → ahora)
  emparejadas con su detalle populado. Toda la agregación POR MÚSCULO ocurre
  AHORA por-sesión en la vista, no en un buffer global: el usuario pidió
  explícitamente que /stats/week muestre solo sesiones y que cada una
  despliegue sus ejercicios + grupos trabajados.

  Dos pasadas al backend:
  1. GET /api/sessions?from=<lunes>  → list summary (sin entries).
  2. GET /api/sessions/:id por cada  → detail populado (secondaryMuscles).

  Si falla la fetch de detalle, la emparejamos con detail=null y la vista
  pinta la cabecera sin desglose: no bloquea el resto.
*/

function mondayOfCurrentWeek(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const isoDay = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - isoDay)
  return d
}

/*
  Desglose de una sesión concreta: músculos primarios + secundarios únicos y
  lista de ejercicios con sus series completadas. Los secundarios no incluyen
  músculos que ya aparecen como primarios (evita el chip duplicado "pecho"
  con doble etiqueta).
*/
export function breakdownForSession(detail) {
  if (!detail) return { primaryMuscles: [], secondaryMuscles: [], exercises: [] }
  const primary = new Set()
  const secondary = new Set()
  const exercises = []
  for (const e of detail.entries ?? []) {
    const completed = (e.sets ?? []).filter((s) => s.completed)
    if (completed.length === 0) continue
    primary.add(e.muscle)
    const secs =
      (e.exercise && typeof e.exercise === 'object' && e.exercise.secondaryMuscles) ||
      []
    for (const sec of secs) secondary.add(sec)
    exercises.push({
      name: e.exerciseName,
      // Lo que se persiste en Session es el nombre canónico (snapshot),
      // pero exponer el id del ejercicio aquí permite al render pintar
      // el alias actual del usuario sin perder el fallback canónico si
      // el alias se borra. Ver [[muscle-chips-pattern]] como referencia
      // del mismo truco con los chips.
      exerciseId:
        (e.exercise && typeof e.exercise === 'object' ? e.exercise._id : e.exercise) ??
        null,
      tracking: e.tracking,
      primaryMuscle: e.muscle,
      sets: completed.map((s) => ({
        weightKg: s.weightKg ?? null,
        reps: s.reps ?? null,
        durationSec: s.durationSec ?? null,
        distanceM: s.distanceM ?? null,
      })),
    })
  }
  // Secundarios ya cubiertos como primarios: quitarlos del set para no
  // duplicar el chip bajo las dos variantes.
  for (const p of primary) secondary.delete(p)
  return {
    primaryMuscles: Array.from(primary),
    secondaryMuscles: Array.from(secondary),
    exercises,
  }
}

export function useWeeklyStats() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const monday = mondayOfCurrentWeek()
      const query =
        `/api/sessions?limit=50&from=${encodeURIComponent(monday.toISOString())}`
      const summaries = await api(query)
      const list = Array.isArray(summaries) ? summaries : []
      const details = await Promise.all(
        list.map((s) =>
          api(`/api/sessions/${s._id}`).catch(() => null),
        ),
      )
      const sessions = list.map((summary, i) => ({
        summary,
        detail: details[i],
      }))
      setState({ loading: false, error: null, sessions })
    } catch (err) {
      setState({ loading: false, error: err, sessions: [] })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const monday = useMemo(() => mondayOfCurrentWeek(), [])

  return {
    loading: state.loading,
    error: state.error,
    sessions: state.sessions,
    sessionCount: state.sessions.length,
    monday,
    refetch: load,
  }
}
