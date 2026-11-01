import { useTranslation } from 'react-i18next'
import { PlayIcon } from '../icons/NavIcons.jsx'

/*
  Card del picker: visualmente hermana de RoutineCard pero semánticamente es
  un botón (dispara `onStart` y crea una sesión), no un enlace al editor.
  Mantener los dos componentes separados evita que RoutineCard acabe con un
  prop `mode="edit"|"train"` y dos ramas de JSX dentro: cada card hace una
  cosa.

  El pin verde con icono play a la derecha da jerarquía al CTA sin usar
  bg-accent en toda la superficie (regla de memoria "CTA accent restraint":
  verde sólido grande se lee fosforito; mejor panel tintado + accent en el
  elemento de acción).
*/
export default function StartRoutineCard({ routine, onStart, disabled = false }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={() => onStart(routine)}
      disabled={disabled}
      aria-label={t('training.startRoutineAria', { name: routine.name })}
      className="card-liquid press group flex w-full items-center gap-4 rounded-container p-4 text-left transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60 md:p-5"
    >
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-display text-base font-semibold tracking-tight text-text">
          {routine.name}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          <span className="tabular">
            {t('routines.exerciseCount', { count: routine.exerciseCount })}
          </span>
          {routine.timesUsed > 0 && (
            <>
              <span>·</span>
              <span className="tabular">
                {t('routines.timesUsed', { count: routine.timesUsed })}
              </span>
            </>
          )}
        </p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-bg shadow-[0_0_18px_-6px_color-mix(in_srgb,var(--color-accent)_70%,transparent)] transition-transform group-hover:translate-x-0.5">
        <PlayIcon className="h-4 w-4" />
      </span>
    </button>
  )
}
