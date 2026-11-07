import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Pide GET /api/stats/muscle-recency una vez al montar y expone
  `{ byMuscle, now, loading, error }`. byMuscle es un objeto plano
  keyed por muscle id; los que no tienen historial llegan como `null`,
  así el consumidor no necesita fusionar con la lista maestra.

  Patrón defensivo: un fallo aquí no debe romper /stats/week. La pantalla
  seguirá pintando las sesiones y el modo Volumen (que no depende de este
  endpoint); solo los modos Recuperación/Descuidado se quedan sin datos.
*/
export function useMuscleRecency() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    byMuscle: null,
    now: null,
  })

  useEffect(() => {
    let cancelled = false
    api('/api/stats/muscle-recency')
      .then((data) => {
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          byMuscle: data?.byMuscle ?? {},
          now: data?.now ?? null,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, byMuscle: {}, now: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
