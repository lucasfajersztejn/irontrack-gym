import { useEffect, useState } from 'react'
import { api } from './api.js'
import { computeStreak, countThisWeek, latest1RM } from './stats.js'

/*
  Home sacará todos sus números del endpoint existente GET /api/sessions
  (lista paginada sin entries). Las agregaciones correrán en cliente hasta
  que Fase 2 añada endpoints dedicados. Es aceptable: el payload está
  acotado (limit=50, ventana 12 semanas) y evita bloquear la UI con cuatro
  fetches en serie.

  Cuatro llamadas en paralelo:
  - sessions (ventana de 12 semanas) → heatmap, racha, semana, últimas 3.
  - routines → contador + "siguiendo hoy" por lastUsedAt.
  - active → modo "Continuar" del CTA.
  - detail de la última sesión → 1RM estimado.

  Un fallo en una no debe dejar en blanco el resto. Si la lista principal
  falla, Home muestra el estado vacío (es más honesto que un spinner
  eterno).
*/
export function useHomeData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
    routines: [],
    activeSession: null,
    latestDetail: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 84) // 12 semanas
      const sessionsQuery =
        `/api/sessions?limit=50&from=${encodeURIComponent(since.toISOString())}`

      const [sessionsRes, routinesRes, activeRes] = await Promise.allSettled([
        api(sessionsQuery),
        api('/api/routines/'),
        api('/api/sessions/active'),
      ])
      if (cancelled) return

      const sessions = sessionsRes.status === 'fulfilled'
        ? sessionsRes.value?.sessions ?? sessionsRes.value?.items ?? sessionsRes.value ?? []
        : []
      const routines = routinesRes.status === 'fulfilled'
        ? routinesRes.value?.routines ?? routinesRes.value?.items ?? routinesRes.value ?? []
        : []
      const activeSession = activeRes.status === 'fulfilled' ? activeRes.value : null

      // Detail del más reciente para el 1RM. Solo si hay al menos una.
      let latestDetail = null
      const mostRecent = sessions[0]
      if (mostRecent?._id || mostRecent?.id) {
        try {
          latestDetail = await api(
            `/api/sessions/${mostRecent._id ?? mostRecent.id}`,
          )
        } catch {
          latestDetail = null
        }
      }
      if (cancelled) return

      const anyError =
        sessionsRes.status === 'rejected' &&
        routinesRes.status === 'rejected'

      setState({
        loading: false,
        error: anyError ? new Error('Home data failed') : null,
        sessions,
        routines,
        activeSession,
        latestDetail,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const sessions = state.sessions
  const today = new Date()

  const suggestedRoutine = state.routines
    .slice()
    .sort((a, b) => {
      const ta = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
      const tb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
      return tb - ta
    })[0]

  const oneRm = latest1RM(state.latestDetail)

  return {
    loading: state.loading,
    error: state.error,
    sessions,
    lastSessions: sessions.slice(0, 3),
    streak: computeStreak(sessions, today),
    weekly: countThisWeek(sessions, today),
    oneRm,
    routinesCount: state.routines.length,
    activeSession: state.activeSession,
    suggestedRoutine,
  }
}
