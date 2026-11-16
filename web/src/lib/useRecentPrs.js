import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for recent PRs.
export function useRecentPrs(sinceDays = 30) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    prs: [],
    sinceDays,
  })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))

    api(`/api/exercises/recent-prs?sinceDays=${sinceDays}`)
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          prs: payload?.prs ?? [],
          sinceDays: payload?.sinceDays ?? sinceDays,
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, prs: [], sinceDays })
      })

    return () => {
      alive = false
    }
  }, [sinceDays])

  return state
}
