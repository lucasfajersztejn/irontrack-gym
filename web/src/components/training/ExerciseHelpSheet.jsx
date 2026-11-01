import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Hoja de ayuda del ejercicio: GIF grande arriba + instrucciones por idioma
  abajo + cerrar. Pensada para el momento "entre series, en el gimnasio":
  pulgar en el móvil, luz dura, el usuario quiere verificar rápido la postura
  sin salir de la sesión.

  Fuente de datos: `exercise` llega populado desde /api/sessions/active
  (sessionController.getActiveSession hace populate). Si por alguna razón el
  objeto no tiene gifUrl (ejercicios custom del propio usuario), mostramos
  un placeholder honesto en vez de un hueco roto.
*/
export default function ExerciseHelpSheet({ open, onClose, exercise }) {
  const { t, i18n } = useTranslation()
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Resetea el estado de fallo de imagen al cambiar de ejercicio para que
  // una red flaky en el ejercicio A no esconda el GIF del ejercicio B.
  useEffect(() => {
    setImgFailed(false)
  }, [exercise?._id])

  if (!open || !exercise) return null

  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const name =
    exercise.name?.[lang] ??
    exercise.name?.es ??
    exercise.name?.en ??
    exercise.exerciseName ??
    '—'
  const instructions = exercise.instructions?.[lang] ?? exercise.instructions?.es ?? []
  const hasInstructions = Array.isArray(instructions) && instructions.length > 0
  const hasGif = Boolean(exercise.gifUrl) && !imgFailed

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal
      aria-label={t('training.helpTitle', { name })}
    >
      <button
        type="button"
        aria-label={t('training.helpClose')}
        onClick={onClose}
        className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
      />
      <div className="card-liquid relative flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-container border border-border/50 p-4 md:max-h-[85vh] md:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-display text-lg font-semibold tracking-tight text-text">
              {name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
              <span className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 font-medium text-accent">
                {t(`catalog.muscles.${exercise.muscle}`, {
                  defaultValue: exercise.muscle,
                })}
              </span>
              <span>
                {t(`catalog.equipment.${exercise.equipment}`, {
                  defaultValue: exercise.equipment,
                })}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
            aria-label={t('training.helpClose')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {hasGif ? (
          <div className="overflow-hidden rounded-container bg-bg">
            <img
              src={exercise.gifUrl}
              alt=""
              onError={() => setImgFailed(true)}
              className="h-auto w-full"
            />
          </div>
        ) : (
          <div className="rounded-container bg-bg px-4 py-10 text-center text-xs text-text-muted">
            {t('training.helpNoGif')}
          </div>
        )}

        {hasInstructions ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              {t('training.helpInstructions')}
            </h3>
            <ol className="flex list-inside list-decimal flex-col gap-1.5 text-sm leading-relaxed text-text">
              {instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="text-sm text-text-muted">{t('training.helpNoInstructions')}</p>
        )}
      </div>
    </div>
  )
}
