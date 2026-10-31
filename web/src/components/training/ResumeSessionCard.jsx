import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlayIcon } from '../icons/NavIcons.jsx'

/*
  Card de "sesión abierta — vuelve a ella". Pulgar-friendly y jerarquía
  primaria (es la acción obvia si existe una activa): usa `cta-liquid` para
  compartir lenguaje con el StartTrainingCTA del Home. El tiempo transcurrido
  se calcula en vivo cada segundo como DISPLAY — el estado real sigue siendo
  el timestamp `startedAt` (invariante spec §9): si el móvil se bloquea y
  vuelve, el contador se recalcula correcto sin perder cuenta.
*/
export default function ResumeSessionCard({ session, onResume }) {
  const { t } = useTranslation()
  const elapsed = useElapsed(session.startedAt)

  const subtitle = session.routineName
    ? t('training.resumeSubWithRoutine', { routine: session.routineName })
    : t('training.resumeSubFree')

  return (
    <button
      type="button"
      onClick={onResume}
      className="cta-liquid press group relative block w-full overflow-hidden rounded-container px-5 py-5 text-left text-text transition-[filter,transform] hover:brightness-[1.12] md:px-6 md:py-6"
    >
      <div className="min-w-0 pr-16">
        <div className="font-display text-xl font-semibold leading-tight tracking-tight md:text-2xl">
          {t('training.resumeTitle')}
        </div>
        <div className="mt-1 truncate text-sm text-text-muted">{subtitle}</div>
        <div className="tabular mt-2 text-xs text-text-muted">
          {t('training.resumeElapsed', { time: elapsed })}
        </div>
      </div>
      <span className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg shadow-[0_0_24px_-6px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] transition-transform group-hover:translate-x-0.5 md:bottom-5 md:right-5">
        <PlayIcon className="h-5 w-5" />
      </span>
    </button>
  )
}

/*
  Hook interno: tick de 1 s solo para forzar re-render del display. El estado
  almacenado es el timestamp, nunca un contador. En reducido-movimiento no
  intervenimos: el tick no es animación, es información.
*/
function useElapsed(startedAtIso) {
  const [, tick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const started = new Date(startedAtIso).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
  return formatElapsed(seconds)
}

function formatElapsed(totalSec) {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}
