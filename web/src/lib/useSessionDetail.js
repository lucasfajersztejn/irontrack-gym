import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for one session's detail.
export function useSessionDetail(sessionId) {
  const [state, setState] = useState({
    loading: Boolean(sessionId),
    error: null,
    detail: null,
  })

  useEffect(() => {
    if (!sessionId) {
      setState({ loading: false, error: null, detail: null })
      return
    }
    let cancelled = false
    setState({ loading: true, error: null, detail: null })
    api(`/api/sessions/${sessionId}`)
      .then((detail) => {
        if (cancelled) return
        setState({ loading: false, error: null, detail })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, detail: null })
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return state
}
