import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Ejercicios estancados para la card del Home.

  Hook simple, mismo molde que useRecentPrs: un fetch al montar, sin caché ni
  stale-while-revalidate porque esta lista solo la pide el Home. Si aparece
  otro consumidor, se eleva a contexto; antes no.

  Contrato del backend (`GET /api/exercises/stalled`):
    { stalled: [{ exerciseId, exerciseName, peakBest1RM, peakHeaviestKg,
                  peakAt, sessionsSince, lastSessionAt }] }
    - Ordenados por sessionsSince desc (más estancado primero).
    - Solo weight_reps; el servidor ya aplica el umbral y la ventana de
      actividad, aquí no se filtra nada.
*/
export function useStalledLifts() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    stalled: [],
  })

  useEffect(() => {
    // Sin setState síncrono de "loading" aquí: el efecto corre una sola vez
    // (sin deps) y el estado inicial ya nace en loading:true. Reintroducirlo
    // solo dispararía un render en cascada que el linter marca y que no
    // compra nada.
    let alive = true

    api('/api/exercises/stalled')
      .then((payload) => {
        if (!alive) return
        setState({ loading: false, error: null, stalled: payload?.stalled ?? [] })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, stalled: [] })
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}
