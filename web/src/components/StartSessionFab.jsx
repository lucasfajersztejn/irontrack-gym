// Floating button to start a training session.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/sessionStore.js'
import { startSession } from '../lib/startSession.js'
import { PlayIcon } from './icons/NavIcons.jsx'

export default function StartSessionFab() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectedRoutineId = useSessionStore((s) => s.selectedRoutineId)
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      await startSession(selectedRoutineId)
      navigate('/training')
    } catch {
      navigate('/training')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={t('nav.startAria')}
      className="press flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-glow-landing transition-[filter,transform] hover:brightness-110 disabled:opacity-60"
    >
      <PlayIcon className="h-6 w-6" />
    </button>
  )
}
