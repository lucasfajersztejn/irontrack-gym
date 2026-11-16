import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

// Weekly stats hooks and helpers.

const WEEK_MS = 7 * 24 * 3600 * 1000

// Monday 00:00 local of the given date's week.
export function mondayOf(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const isoDay = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - isoDay)
  return d
}

// ISO week number.
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d - firstThursday) / WEEK_MS)
}

// Per-session muscle and exercise breakdown.
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
  for (const p of primary) secondary.delete(p)
  return {
    primaryMuscles: Array.from(primary),
    secondaryMuscles: Array.from(secondary),
    exercises,
  }
}

// Aggregate muscle usage for a week of sessions.
export function weekMuscleUsage(sessions) {
  const primary = new Set()
  const secondary = new Set()
  for (const { detail } of sessions ?? []) {
    const b = breakdownForSession(detail)
    for (const m of b.primaryMuscles) primary.add(m)
    for (const m of b.secondaryMuscles) secondary.add(m)
  }
  for (const m of primary) secondary.delete(m)
  return {
    primary: Array.from(primary),
    secondary: Array.from(secondary),
  }
}

export function useWeeklyStats(weekStart) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
  })

  const startMs = weekStart.getTime()

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const from = new Date(startMs)
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
