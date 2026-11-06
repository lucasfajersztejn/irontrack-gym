import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Carga la curva histórica de un ejercicio desde GET /api/exercises/:id/progress.
  Fetch lazy: el hook solo dispara cuando `enabled` es true, que es como lo
  activa la fila de WeekStats al expandirse. Mientras la fila esté cerrada
  no hay petición. Al cerrarla, el estado se queda cacheado en memoria del
  componente — si el usuario vuelve a abrir la misma fila no re-pedimos.

  Alcance intencionalmente simple:
  - Sin caché entre filas distintas (cada <ExerciseProgressRow> es un hook
    nuevo). En una lista de 10-15 ejercicios por sesión, el coste real es
    nulo porque la expansión es manual. Si el caso cambia, se eleva el
    estado a un contexto.
  - Sin refetch al cambiar de semana. Los puntos no dependen de la ventana
    visible — son toda la historia del ejercicio.
*/
export function useExerciseProgress(exerciseId, enabled) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    points: null,
  })

  useEffect(() => {
    if (!enabled || !exerciseId) return undefined
    // Si ya tenemos puntos para este id no re-pedimos — el `points != null`
    // en la guarda principal del render evita el flash, pero sin esta línea
    // cada toggle de expansión relanzaría fetch.
    if (state.points != null) return undefined

    let cancelled = false
    setState({ loading: true, error: null, points: null })
    api(`/api/exercises/${encodeURIComponent(exerciseId)}/progress`)
      .then((data) => {
        if (cancelled) return
        setState({ loading: false, error: null, points: data?.points ?? [] })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ loading: false, error: err, points: null })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, exerciseId])

  return state
}
