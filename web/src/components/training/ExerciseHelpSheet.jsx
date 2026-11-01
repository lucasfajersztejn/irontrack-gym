import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExerciseAlias, useExerciseName } from '../../lib/exerciseName.js'

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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const { name, canonical, isAliased } = useExerciseName(exercise)
  const { setAlias, clear, saving } = useExerciseAlias(exercise?._id)

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
  // También cerramos el editor para que no "arrastre" un draft a otro.
  useEffect(() => {
    setImgFailed(false)
    setEditing(false)
    setDraft('')
  }, [exercise?._id])

  // Auto-focus al input al abrir el editor; sin esto el usuario tiene que
  // tocar el campo tras pulsar el lápiz.
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (!open || !exercise) return null

  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const instructions = exercise.instructions?.[lang] ?? exercise.instructions?.es ?? []
  const hasInstructions = Array.isArray(instructions) && instructions.length > 0
  const hasGif = Boolean(exercise.gifUrl) && !imgFailed

  async function handleSave() {
    const value = draft.trim()
    if (!value || value === canonical || value === name) {
      setEditing(false)
      return
    }
    try {
      await setAlias(value)
    } catch {
      /* el error ya hace rollback en useExerciseAlias */
    }
    setEditing(false)
  }

  async function handleRestore() {
    try {
      await clear()
    } catch {
      /* idem */
    }
    setEditing(false)
  }

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
          <div className="min-w-0 flex-1">
            {editing ? (
              /*
                Modo edición del alias: input al ancho de la cabecera +
                acciones compactas abajo. Enter guarda, Esc cancela — las
                mismas teclas que uno espera en un "rename" de app.
              */
              <div className="flex flex-col gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSave()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditing(false)
                    }
                  }}
                  maxLength={40}
                  aria-label={t('training.aliasInputLabel')}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2 font-display text-base font-semibold text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="press rounded-control bg-accent px-3 py-1.5 font-medium text-bg disabled:opacity-50"
                  >
                    {t('training.aliasSave')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="press rounded-control border border-border bg-surface px-3 py-1.5 text-text hover:bg-surface-2"
                  >
                    {t('training.aliasCancel')}
                  </button>
                  {isAliased && (
                    <button
                      type="button"
                      onClick={handleRestore}
                      disabled={saving}
                      className="press ml-auto rounded-control px-2 py-1.5 text-text-muted hover:text-text disabled:opacity-50"
                    >
                      {t('training.aliasRestore')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 font-display text-lg font-semibold tracking-tight text-text">
                    {name}
                  </h2>
                  {isAliased && (
                    /*
                      Nombre canónico debajo para que el usuario no pierda la
                      referencia (importante: el catálogo público usa este
                      nombre, y los compañeros también). Clamp a una línea.
                    */
                    <p className="mt-0.5 line-clamp-1 text-xs italic text-text-muted">
                      {t('training.aliasOriginal', { name: canonical })}
                    </p>
                  )}
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
                  onClick={() => {
                    setDraft(name)
                    setEditing(true)
                  }}
                  aria-label={t('training.aliasEdit')}
                  className="press mt-0.5 rounded-full p-1.5 text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </button>
              </div>
            )}
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
