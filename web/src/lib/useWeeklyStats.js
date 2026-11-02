import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/*
  Vista semanal: devolvemos las sesiones de UNA semana (lunes → domingo)
  emparejadas con su detalle populado. Toda la agregación POR MÚSCULO ocurre
  AHORA por-sesión en la vista, no en un buffer global: el usuario pidió
  explícitamente que /stats/week muestre solo sesiones y que cada una
  despliegue sus ejercicios + grupos trabajados.

  La semana a mostrar la decide el caller (WeekStats mantiene el offset y
  pasa el lunes correspondiente). El hook acota con from/to para poder pedir
  semanas pasadas; para la semana actual, `to` cae en el futuro y no recorta
  nada.

  Dos pasadas al backend:
  1. GET /api/sessions?from=<lunes>&to=<domingo> → list summary (sin entries).
  2. GET /api/sessions/:id por cada             → detail (secondaryMuscles).

  Si falla la fetch de detalle, la emparejamos con detail=null y la vista
  pinta la cabecera sin desglose: no bloquea el resto.
*/

const WEEK_MS = 7 * 24 * 3600 * 1000

// Lunes 00:00 (hora local) de la semana que contiene `date`. setHours/setDate
// en hora local tratan bien los saltos de horario de verano: mantienen la
// hora de pared, así que el lunes sigue siendo medianoche tras el cambio.
export function mondayOf(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const isoDay = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - isoDay)
  return d
}

/*
  Número de semana ISO-8601 (la semana 1 es la que contiene el primer jueves
  del año). Lo calculamos en UTC para que el redondeo no baile con el huso
  horario, partiendo del jueves de la semana pedida.
*/
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3) // jueves de esta semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d - firstThursday) / WEEK_MS)
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

export function useWeeklyStats(weekStart) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
  })

  // Dependemos del timestamp, no del objeto Date: así el efecto solo se
  // vuelve a disparar cuando cambia la semana, no en cada render que cree
  // un Date nuevo con el mismo instante.
  const startMs = weekStart.getTime()

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const from = new Date(startMs)
      // Fin de la semana: 1 ms antes del lunes siguiente, para no incluir una
      // sesión del lunes de la semana próxima (el backend filtra con $lte).
      const to = new Date(startMs + WEEK_MS - 1)
      const query =
        `/api/sessions?limit=50` +
        `&from=${encodeURIComponent(from.toISOString())}` +
        `&to=${encodeURIComponent(to.toISOString())}`
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
  }, [startMs])

  useEffect(() => {
    load()
  }, [load])

  const monday = useMemo(() => new Date(startMs), [startMs])

  return {
    loading: state.loading,
    error: state.error,
    sessions: state.sessions,
    sessionCount: state.sessions.length,
    monday,
    refetch: load,
  }
}
