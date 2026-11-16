import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for muscle recency.
export function useMuscleRecency() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    byMuscle: null,
    now: null,
  })

  useEffect(() => {
    let cancelled = false
    api('/api/stats/muscle-recency')
      .then((data) => {
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          byMuscle: data?.byMuscle ?? {},
          now: data?.now ?? null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, byMuscle: {}, now: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
