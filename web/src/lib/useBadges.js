import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Muro de insignias. Un fetch al montar; sin caché a mano porque solo lo pide
  la pantalla de Medallas. Mismo molde que useRecords / useStalledLifts.

  Contrato del backend (`GET /api/badges`):
    {
      badges: [{ slug, name:{es,en}, description:{es,en}, category, tier,
                 iconUrl, unlocked, unlockedAt, progress:{ current, target, pct } }],
      counts: { unlocked, total }
    }
    - badges vienen ordenados por categoría y tier; el frontend solo agrupa.
*/
export function useBadges() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    badges: [],
    counts: { unlocked: 0, total: 0 },
  })

  useEffect(() => {
    let alive = true

    api('/api/badges')
      .then((payload) => {
        if (!alive) return
        setState({
          loading: false,
          error: null,
          badges: payload?.badges ?? [],
          counts: payload?.counts ?? { unlocked: 0, total: 0 },
        })
      })
      .catch((err) => {
        if (!alive) return
        setState({
          loading: false,
          error: err,
          badges: [],
          counts: { unlocked: 0, total: 0 },
        })
      })

    return () => {
      alive = false
    }
  }, [])

  return state
}
