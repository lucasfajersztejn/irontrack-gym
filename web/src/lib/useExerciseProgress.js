import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for an exercise's progress points.
export function useExerciseProgress(exerciseId, enabled) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    points: null,
  })

  useEffect(() => {
    if (!enabled || !exerciseId) return undefined
    if (state.points != null) return undefined

    let cancelled = false
    setState({ loading: true, error: null, points: null })
    api(`/api/exercises/${encodeURIComponent(exerciseId)}/progress`)
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, error: null, points: data?.points ?? [] })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, points: null })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, exerciseId])

  return state
}
