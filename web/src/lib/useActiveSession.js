import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for the active session.
export function useActiveSession() {
  const [state, setState] = useState({ loading: true, error: null, session: null })

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const session = await api('/api/sessions/active')
      setState({ loading: false, error: null, session })
    } catch (err) {
      setState({ loading: false, error: err, session: null })
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const setSession = useCallback((session) => {
    setState((s) => ({ ...s, session }))
  }, [])

  return { ...state, refetch, setSession }
}
