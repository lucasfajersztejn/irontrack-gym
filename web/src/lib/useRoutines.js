import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

// Hook for the routines list.
export function useRoutines() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    routines: [],
  })

  const fetchAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const routines = await api('/api/routines')
      setState({ loading: false, error: null, routines })
    } catch (err) {
      setState({ loading: false, error: err, routines: [] })
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const remove = useCallback(async (id) => {
    const previous = state.routines
    setState((s) => ({ ...s, routines: s.routines.filter((r) => r._id !== id) }))
    try {
      await api(`/api/routines/${id}`, { method: 'DELETE' })
    } catch (err) {
      setState((s) => ({ ...s, routines: previous, error: err }))
      throw err
    }
  }, [state.routines])

  const reorder = useCallback(async (nextRoutines) => {
    const previous = state.routines
    setState((s) => ({ ...s, routines: nextRoutines }))
    try {
      await api('/api/routines/reorder', {
        method: 'PATCH',
        body: { ids: nextRoutines.map((r) => r._id) },
      })
    } catch (err) {
      setState((s) => ({ ...s, routines: previous, error: err }))
      throw err
    }
  }, [state.routines])

  return { ...state, refetch: fetchAll, remove, reorder }
}
