import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlayIcon } from '../icons/NavIcons.jsx'

/*
  CTA principal de la pantalla. Es la "glow earned" de Home (una sola por
  pantalla, DESIGN.md Glow-Is-Earned): fondo acento, halo verde, botón play.

  Tres estados según los datos:
  - Hay sesión activa → "Continuar" + nombre de la rutina.
  - Hay rutina sugerida (la última usada) → "Siguiendo hoy: {routine}".
  - Nada → sólo "Empezar a entrenar". Enlaza igualmente a /training, donde
    el usuario podrá elegir una rutina o un ejercicio libre.
*/
export default function StartTrainingCTA({ activeSession, suggestedRoutine }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  const title = activeSession ? t('home.continueTraining') : t('home.startTraining')
  const subtitle = activeSession
    ? activeSession.routineName
    : suggestedRoutine
      ? t('home.followingToday', { routine: suggestedRoutine.name })
      : t('home.noRoutineYet')

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <Link
        to="/training"
        className="cta-liquid group relative flex items-center justify-between gap-4 overflow-hidden rounded-container px-5 py-5 text-text transition-[filter,transform] hover:brightness-[1.12] active:scale-[0.99] md:px-6 md:py-6"
      >
        <div className="min-w-0">
          <div
            className="font-display text-2xl font-semibold leading-[1.05] tracking-tight md:text-[28px]"
            style={{ textWrap: 'balance' }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 truncate text-sm leading-snug text-text-muted">
              {subtitle}
            </div>
          )}
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-bg shadow-[0_0_24px_-6px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] transition-transform group-hover:translate-x-0.5">
          <PlayIcon className="h-5 w-5" />
        </span>
      </Link>
    </motion.div>
  )
}
