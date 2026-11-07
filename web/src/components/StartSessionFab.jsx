import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSessionStore } from '../stores/sessionStore.js'
import { startSession } from '../lib/startSession.js'
import { PlayIcon } from './icons/NavIcons.jsx'

/*
  FAB central del navbar mobile. Es el único punto de arranque global de
  sesión: en desktop el usuario pulsa directamente desde NextWorkoutCard
  en Home (o el picker de /training), así que aquí solo vive la variante
  circular de mobile.

  Flujo: leer rutina seleccionada del store (la fija NextWorkoutCard),
  llamar startSession() y navegar a /training. Si hay sesión activa, el
  409 del backend lo intercepta startSession() y devuelve la activa, con
  lo que el FAB se comporta como "continuar" sin lógica adicional aquí.

  Nunca deshabilitado por falta de rutina: sin selección arranca sesión
  libre (routineId = null). Un botón grande que no hace nada es peor
  que uno que abre el picker como fallback.
*/
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
      // Al pasar a /training, su propio catch pinta el error inline. No
      // duplicamos toast + mensaje aquí.
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
