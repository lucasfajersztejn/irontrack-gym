import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { estimate1RM } from './stats.js'

// Exercise history and PR detection for the live session.

const PR_KIND = {
  heaviestKg: 'heaviestKg',
  best1RM: 'best1RM',
  bestReps: 'bestReps',
}

function uniqueExerciseIds(session) {
  const ids = []
  for (const e of session?.entries ?? []) {
    const id = typeof e.exercise === 'string' ? e.exercise : e.exercise?._id
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export function useExerciseHistory(initialSession) {
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(
    () => uniqueExerciseIds(initialSession).length > 0,
  )
  const baselineRef = useRef({})

  useEffect(() => {
    let cancelled = false
    const ids = uniqueExerciseIds(initialSession)
    if (ids.length === 0) return undefined
    async function load() {
      try {
        const data = await api(
          `/api/exercises/history?ids=${encodeURIComponent(ids.join(','))}`,
        )
        if (cancelled) return
        setHistory(data)
        baselineRef.current = Object.fromEntries(
          Object.entries(data).map(([id, v]) => [id, { ...v.prs }]),
        )
      } catch {
        if (!cancelled) setHistory({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession?._id])

  // Detect a PR for a set against the baseline.
  const detectPR = (exerciseId, tracking, set) => {
    if (!exerciseId) return null
    const base = baselineRef.current[exerciseId]
    if (!base) return null

    if (tracking === 'weight_reps') {
      let hit = null
      if (set.weightKg > 0 && (base.heaviestKg == null || set.weightKg > base.heaviestKg)) {
        hit = { kind: PR_KIND.heaviestKg, value: set.weightKg }
        base.heaviestKg = set.weightKg
      }
      if (set.weightKg != null && set.reps != null) {
        const oneRm = Math.round(estimate1RM(set.weightKg, set.reps) * 10) / 10
        if (oneRm > 0 && (base.best1RM == null || oneRm > base.best1RM)) {
          if (!hit) hit = { kind: PR_KIND.best1RM, value: oneRm }
          base.best1RM = oneRm
        }
      }
      return hit
    }

    if (tracking === 'reps') {
      if (set.reps != null && (base.bestReps == null || set.reps > base.bestReps)) {
        base.bestReps = set.reps
        return { kind: PR_KIND.bestReps, value: set.reps }
      }
    }

    return null
  }

  return { history, loading, detectPR }
}

export { PR_KIND }
