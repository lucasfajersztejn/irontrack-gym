import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for stalled lifts.
export function useStalledLifts() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    stalled: [],
  })

  useEffect(() => {
    let alive = true

    api('/api/exercises/stalled')
      .then((payload) => {
        if (!alive) return
        setState({ loading: false, error: null, stalled: payload?.stalled ?? [] })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, stalled: [] })
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}
