import { useEffect, useState } from 'react'
import { api } from './api.js'
import { computeStreak, countThisWeek, latest1RM } from './stats.js'
import { pickNextRoutine } from './nextRoutine.js'

// Aggregated data for Home.
export function useHomeData() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    sessions: [],
    routines: [],
    activeSession: null,
    latestDetail: null,
    badgeCounts: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 84)
      const sessionsQuery =
        `/api/sessions?limit=50&from=${encodeURIComponent(since.toISOString())}`

      const [sessionsRes, routinesRes, activeRes, badgesRes] = await Promise.allSettled([
        api(sessionsQuery),
        api('/api/routines/'),
        api('/api/sessions/active'),
        api('/api/badges/counts'),
      ])
      if (cancelled) return

      const sessions = sessionsRes.status === 'fulfilled'
        ? sessionsRes.value?.sessions ?? sessionsRes.value?.items ?? sessionsRes.value ?? []
        : []
      const routines = routinesRes.status === 'fulfilled'
        ? routinesRes.value?.routines ?? routinesRes.value?.items ?? routinesRes.value ?? []
        : []
      const activeSession = activeRes.status === 'fulfilled' ? activeRes.value : null

      const badgeCounts = badgesRes.status === 'fulfilled'
        ? badgesRes.value?.counts ?? null
        : null

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
        badgeCounts,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const sessions = state.sessions
  const today = new Date()

  const lastFinishedSession = sessions.find(
    (s) => !state.activeSession || s._id !== state.activeSession._id,
  )
  const suggestedRoutine = pickNextRoutine(state.routines, lastFinishedSession)

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
    routines: state.routines,
    activeSession: state.activeSession,
    suggestedRoutine,
    badgeCounts: state.badgeCounts,
  }
}
