import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  All-time PRs del usuario para el bloque "Récords" en Home.

  Contrato del backend (`GET /api/stats/records`):
    { records: [{
        exerciseId, exerciseName, muscle, tracking,
        heaviestKg: { value, achievedAt } | null,
        best1RM:    { value, achievedAt } | null,
        bestReps:   { value, achievedAt } | null,
        latestAt,  // PR más reciente del ejercicio; ya ordena la lista.
    }] }

  Un fetch al montar. No cachea a mano por la misma razón que useRecentPrs:
  si aparece otro consumidor, envolver en SWR o contexto; antes no.
*/
export function useRecords() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    records: [],
  })

  useEffect(() => {
    let alive = true
    api('/api/stats/records')
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          records: payload?.records ?? [],
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, records: [] })
      })
    return () => {
      alive = false
    }
  }, [])

  return state
}
