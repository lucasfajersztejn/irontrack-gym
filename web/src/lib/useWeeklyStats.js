import { useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/*
  Agregados de la semana actual (ISO: lunes → ahora).

  Dos pasadas al backend:
  1. GET /api/sessions?from=<lunes> para la lista summary (sin entries).
  2. Un detail por cada sesión listada para poder desglosar series por
     músculo y pesos máximos. En volumen semanal normal son 3–7 sesiones,
     así que paralelizar con Promise.all es asumible. Si se dispara el
     volumen (usuario con 20 sesiones/semana) consideramos un endpoint
     agregado dedicado; hoy sería sobre-ingeniería.

  Si falla alguna fetch de detalle, la ignoramos (no bloquea la vista) y
  los agregados cuentan lo que sí se trajo.
*/

function mondayOfCurrentWeek(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0 = domingo, 1 = lunes, ... 6 = sábado.
  // ISO quiere lunes = 0, domingo = 6. Normalizamos.
  const isoDay = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - isoDay)
  return d
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
      const m = byMuscle.get(e.muscle) ?? {
        muscle: e.muscle,
        sets: 0,
        volume: 0,
        maxWeight: 0,
      }
      for (const set of e.sets ?? []) {
        if (!set.completed) continue
        totalCompletedSets += 1
        m.sets += 1
        if (e.tracking === 'weight_reps' && set.weightKg != null && set.reps != null) {
          const vol = set.weightKg * set.reps
          totalVolume += vol
          m.volume += vol
          if (set.weightKg > m.maxWeight) m.maxWeight = set.weightKg
        }
      }
      byMuscle.set(e.muscle, m)
    }
  }

  return {
    totalDurationSec,
    totalVolume,
    totalCompletedSets,
    byMuscle: Array.from(byMuscle.values())
      .filter((m) => m.sets > 0)
      .sort((a, b) => b.volume - a.volume || b.sets - a.sets),
  }
}

export function useWeeklyStats() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    summaries: [],
    details: [],
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const monday = mondayOfCurrentWeek()
        const query =
          `/api/sessions?limit=50&from=${encodeURIComponent(monday.toISOString())}`
        const summaries = await api(query)
        if (cancelled) return

        const details = await Promise.all(
          (Array.isArray(summaries) ? summaries : []).map((s) =>
            api(`/api/sessions/${s._id}`).catch(() => null),
          ),
        )
        if (cancelled) return

        setState({
          loading: false,
          error: null,
          summaries,
          details: details.filter(Boolean),
        })
      } catch (err) {
        if (cancelled) return
        setState({ loading: false, error: err, summaries: [], details: [] })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => aggregate(state.details), [state.details])

  return {
    loading: state.loading,
    error: state.error,
    sessionCount: state.summaries.length,
    monday: mondayOfCurrentWeek(),
    ...stats,
  }
}
