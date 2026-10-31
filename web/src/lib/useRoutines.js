import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Lista resumida de rutinas del usuario. El backend devuelve summary (sin
  el array de exercises) con exerciseCount, lastUsedAt y timesUsed, que es
  exactamente lo que la card pinta: no hace falta pedir detalle para la
  lista.

  `remove` optimistiza localmente antes de confirmar el DELETE: borrar una
  rutina es una acción con confirmación previa, pero el latencia de red
  en la segunda confirmación visual (ver cómo desaparece) debe ser cero.
  Si el backend falla, revertimos y mostramos el error.
*/
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

  return { ...state, refetch: fetchAll, remove }
}
