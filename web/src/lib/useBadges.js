import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for the user's badges.
export function useBadges() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    badges: [],
    counts: { unlocked: 0, total: 0 },
  })

  useEffect(() => {
    let alive = true

    api('/api/badges')
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          badges: payload?.badges ?? [],
          counts: payload?.counts ?? { unlocked: 0, total: 0 },
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({
          loading: false,
          error: err,
          badges: [],
          counts: { unlocked: 0, total: 0 },
        })
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}
