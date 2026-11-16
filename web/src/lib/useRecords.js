import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for personal records.
export function useRecords() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    records: [],
  })

  useEffect(() => {
    let alive = true
    api('/api/stats/records')
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          records: payload?.records ?? [],
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, records: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}
