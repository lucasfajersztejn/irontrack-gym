import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Detalle de UNA sesión (`GET /api/sessions/:id`) con entries populados.

  Lazy respecto al id: sin `id` no hay fetch, no cargamos sesiones por
  curiosidad. Cada cambio de id dispara un fetch nuevo; no cacheamos
  entre ids porque el consumidor (SelectedWorkoutCard) solo necesita el
  último elegido en pantalla.

  Devuelve shape idéntico al que ya usa `useHomeData.latestDetail`, lo
  que facilita reutilizar `breakdownForSession()` por encima.
*/
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
