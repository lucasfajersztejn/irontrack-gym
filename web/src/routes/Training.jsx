// Training route: pick a routine to start, or resume the active live session.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import StartRoutineCard from '../components/training/StartRoutineCard.jsx'
import SessionLiveView from '../components/training/SessionLiveView.jsx'
import { api } from '../lib/api.js'
import { startSession as startSessionApi } from '../lib/startSession.js'
import { useActiveSession } from '../lib/useActiveSession.js'
import { useRoutines } from '../lib/useRoutines.js'

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-24 animate-pulse rounded-container bg-surface-2" />
      <div className="h-20 animate-pulse rounded-container bg-surface-2" />
      <div className="h-20 animate-pulse rounded-container bg-surface-2" />
    </div>
  )
}

function Picker({ routines, loadingRoutines, onStart, starting }) {
  const { t } = useTranslation()

  if (loadingRoutines) return <Skeleton />

  return (
    <div className="flex flex-col gap-5">
      {routines.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('training.pickerRoutinesTitle')}
          </h2>
          <div className="flex flex-col gap-2">
            {routines.map((r) => (
              <StartRoutineCard
                key={r._id}
                routine={r}
                onStart={() => onStart(r._id)}
                disabled={starting}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
          <p className="font-display text-base font-semibold text-text">
            {t('training.noRoutinesTitle')}
          </p>
          <p className="text-sm text-text-muted">{t('training.noRoutinesSub')}</p>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="h-px flex-1 bg-border/60" />
        <span>{t('training.or')}</span>
        <span className="h-px flex-1 bg-border/60" />
      </div>

      <button
        type="button"
        onClick={() => onStart(null)}
        disabled={starting}
        className="press rounded-container border border-border bg-surface px-4 py-4 text-sm font-semibold text-text transition-[filter,transform] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('training.startFreeSession')}
      </button>
    </div>
  )
}

export default function Training() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { loading, session, setSession } = useActiveSession()
  const { loading: loadingRoutines, routines } = useRoutines()
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState(null)

  async function startSession(routineId) {
    setStarting(true)
    setError(null)
    try {
      const created = await startSessionApi(routineId)
      setSession(created)
    } catch (err) {
      setError(err)
    } finally {
      setStarting(false)
    }
  }

  async function finishSession() {
    if (!session?._id) return
    setFinishing(true)
    try {
      const closed = await api(`/api/sessions/${session._id}/finish`, {
        method: 'POST',
      })
      void closed
      setSession(null)
      navigate('/home')
    } catch (err) {
      setError(err)
    } finally {
      setFinishing(false)
    }
  }

  async function cancelSession() {
    if (!session?._id) return
    setCancelling(true)
    try {
      await api(`/api/sessions/${session._id}`, { method: 'DELETE' })
      setSession(null)
      navigate('/home')
    } catch (err) {
      setError(err)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 md:gap-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
          {t('training.title')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {session
            ? t('training.subtitleActive')
            : t('training.subtitleIdle')}
        </p>
      </header>

      {loading ? (
        <Skeleton />
      ) : session ? (
        <SessionLiveView
          session={session}
          onFinish={finishSession}
          onCancel={cancelSession}
          finishing={finishing}
          cancelling={cancelling}
        />
      ) : (
        <Picker
          routines={routines}
          loadingRoutines={loadingRoutines}
          onStart={startSession}
          starting={starting}
        />
      )}

      {error && (
        <p className="text-sm text-error">
          {error.payload?.message ?? error.message ?? t('training.errors.generic')}
        </p>
      )}
    </div>
  )
}
