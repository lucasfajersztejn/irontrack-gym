import { useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for one routine.
export function useRoutine(id) {
  const [state, setState] = useState({
    loading: Boolean(id),
    error: null,
    routine: null,
  })

  useEffect(() => {
    if (!id) {
      setState({ loading: false, error: null, routine: null })
      return
    }
    let cancelled = false
    setState({ loading: true, error: null, routine: null })
    api(`/api/routines/${id}`)
      .then((routine) => {
        if (cancelled) return
        setState({ loading: false, error: null, routine })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, routine: null })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return state
}
