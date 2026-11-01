import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import StartRoutineCard from '../components/training/StartRoutineCard.jsx'
import SessionLiveView from '../components/training/SessionLiveView.jsx'
import { api } from '../lib/api.js'
import { useActiveSession } from '../lib/useActiveSession.js'
import { useRoutines } from '../lib/useRoutines.js'

/*
  Pantalla /training. Dos modos, mismo URL:

  - Si hay sesión activa → SessionLiveView (header, lista de ejercicios con
    series editables, añadir/quitar, terminar).
  - Si no hay activa → lista de rutinas para arrancar + sesión libre.

  La detección vive en `useActiveSession`, un GET único al /active del backend
  (barato — ver sessionController.getActiveSession). Tras POST /sessions o
  POST /:id/finish empujamos el documento devuelto al hook con setSession y
  evitamos un segundo round-trip.

  Nota: la navegación entre "picker" y "live" NO abre una nueva ruta: la
  misma /training renderiza una vista u otra. Así un refresh en móvil o un
  tap en el nav tab vuelve exactamente al mismo sitio sin inventar rutas
  anidadas que la URL bar tendría que mantener.
*/

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

      {/*
        Separador tipográfico "— o —": barato, sin ruido visual, divide
        "cargar plantilla" de "empezar sin plantilla" como dos ramas iguales
        del flujo. Nada de bordes de 1 px (The Flat-At-Rest Rule).
      */}
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
  const { loading, session, setSession } = useActiveSession()
  const { loading: loadingRoutines, routines } = useRoutines()
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState(null)

  async function startSession(routineId) {
    setStarting(true)
    setError(null)
    try {
      const created = await api('/api/sessions', {
        method: 'POST',
        body: routineId ? { routine: routineId } : {},
      })
      setSession(created)
    } catch (err) {
      // 409 significa "ya tenías una activa"; el backend adjunta activeId.
      // Un refetch no sirve: puede ser que el estado local esté desincronizado
      // (p. ej. otra pestaña abrió sesión). Rehidratamos con un GET /active
      // en vez de reintentar POST, para no crear nunca una segunda sesión.
      if (err?.status === 409) {
        try {
          const existing = await api('/api/sessions/active')
          setSession(existing)
        } catch {
          setError(err)
        }
      } else {
        setError(err)
      }
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
      // closed.endedAt viene poblado: setSession a null para volver al picker
      // (el hook interpreta null como "no activa"). Guardamos el documento en
      // una navegación futura cuando tengamos vista de resumen.
      void closed
      setSession(null)
    } catch (err) {
      setError(err)
    } finally {
      setFinishing(false)
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
          finishing={finishing}
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
