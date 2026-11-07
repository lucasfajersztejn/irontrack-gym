import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  PRs del último mes para la card del Home.

  Hook simple: un fetch al montar y un refresco cuando cambia `sinceDays`.
  No hace stale-while-revalidate ni cachea a mano porque esta lista no se
  pide desde otras pantallas; si en el futuro aparece otro consumidor,
  envolvemos con useSWR o un contexto. Antes no.

  Contrato del backend (`GET /api/exercises/recent-prs?sinceDays=N`):
    { sinceDays, prs: [{ exerciseId, exerciseName, kind, value, prevValue, achievedAt }] }
    - kind: 'heaviest' | '1rm' | 'reps'
    - prs vienen ordenados por achievedAt desc.
*/
export function useRecentPrs(sinceDays = 30) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    prs: [],
    sinceDays,
  })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))

    api(`/api/exercises/recent-prs?sinceDays=${sinceDays}`)
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          prs: payload?.prs ?? [],
          sinceDays: payload?.sinceDays ?? sinceDays,
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({ loading: false, error: err, prs: [], sinceDays })
      })

    return () => {
      alive = false
    }
  }, [sinceDays])

  return state
}
