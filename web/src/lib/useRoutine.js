import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Detalle de una rutina (GET /api/routines/:id) con exercises populados.
  Devuelve el objeto crudo del backend; el editor hace su propia normalización
  a su estado local para no acoplar el modelo del backend al estado de la UI.
*/
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
