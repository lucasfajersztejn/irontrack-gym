import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionSetRow from './SessionSetRow.jsx'
import ExerciseHelpSheet from './ExerciseHelpSheet.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import { useUser } from '../../contexts/UserContext.jsx'
import { barWeightFor } from '../../lib/weight.js'

/*
  Card de un ejercicio dentro de la sesión live. Header con nombre + chips
  (músculo + progreso) + botón ayuda (?) + botón borrar. Lista de
  SessionSetRow + "+ Añadir serie".

  Datos del ejercicio: /api/sessions/active hace populate, así que
  entry.exercise es el documento completo del catálogo (gifUrl,
  instructions, equipment, usesBar). Cuando el usuario añade un ejercicio
  mid-session, también llega completo del picker. Si falla populate
  (ejercicio borrado del catálogo), entry.exercise puede ser null u
  ObjectId — defensivo abajo.

  Peso de barra: barWeightFor() lee de exercise.defaultBarWeightKg
  (Z=7, Smith=15, barbell=user default) con fallback a 20 kg. Durante la
  sesión no hay override per-entry (el modelo de session no lo guarda);
  si en el futuro se añade, aquí es donde se consultaría primero.
*/
export default function SessionExerciseCard({
  entry,
  onAddSet,
  onUpdateSet,
  onToggleSetComplete,
  onRemoveSet,
  onRemoveEntry,
}) {
  const { t } = useTranslation()
  const { user } = useUser()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const completedCount = entry.sets.filter((s) => s.completed).length

  const exerciseObj =
    entry.exercise && typeof entry.exercise === 'object' ? entry.exercise : null
  const usesBar = Boolean(exerciseObj?.usesBar)
  const barInputMode = user?.settings?.barInputMode ?? 'plates'
  const userBarKg = user?.settings?.defaultBarWeightKg ?? 20
  const barKg = exerciseObj
    ? barWeightFor(exerciseObj, null, userBarKg)
    : 0

  return (
    <article className="card-liquid flex flex-col gap-3 rounded-container p-3 md:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight text-text">
            {entry.exerciseName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              {t(`catalog.muscles.${entry.muscle}`, { defaultValue: entry.muscle })}
            </span>
            <span className="tabular text-[11px] text-text-muted">
              {t('training.setsProgress', {
                done: completedCount,
                total: entry.sets.length,
              })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {exerciseObj && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t('training.helpOpen', { name: entry.exerciseName })}
              className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2M12 17h.01" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={t('training.removeExercise')}
            className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color] hover:text-error"
          >
            <svg
              width="16"
              height="16"
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
        </div>
      </header>

      {entry.sets.length > 0 && (
        <div className="flex flex-col gap-1">
          {/*
            Cabecera columnar: minúscula, label-casing, por encima de las
            filas. Dos columnas de valor según tracking; etiqueta "✓" sobre
            el checkbox y espacio sobre el borrar.
          */}
          <SetListHeader tracking={entry.tracking} />
          {entry.sets.map((set, i) => (
            <SessionSetRow
              key={i}
              index={i}
              set={set}
              tracking={entry.tracking}
              usesBar={usesBar}
              barInputMode={barInputMode}
              barKg={barKg}
              onChange={(patch) => onUpdateSet(i, patch)}
              onToggleComplete={() =>
                onToggleSetComplete(i, !set.completed)
              }
              onDelete={() => onRemoveSet(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onAddSet}
        className="press self-start rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
      >
        + {t('training.addSet')}
      </button>

      <ConfirmModal
        open={confirmOpen}
        title={t('training.confirmRemoveExerciseTitle', {
          name: entry.exerciseName,
        })}
        description={t('training.confirmRemoveExerciseSub')}
        confirmLabel={t('training.removeExercise')}
        onConfirm={() => {
          setConfirmOpen(false)
          onRemoveEntry()
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ExerciseHelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        exercise={exerciseObj}
      />
    </article>
  )
}

/*
  Cabecera de columnas por tracking. El tamaño del grid replica el de
  SessionSetRow (flex con inputs 1fr) para que las etiquetas caigan sobre
  sus columnas. Uso `text-[10px] uppercase tracking-[0.08em]` consistente
  con los labels del editor de rutinas.
*/
function SetListHeader({ tracking }) {
  const { t } = useTranslation()
  const labels = (() => {
    switch (tracking) {
      case 'weight_reps':
        return [t('training.setFields.weight'), t('training.setFields.reps')]
      case 'reps':
        return [t('training.setFields.reps')]
      case 'time':
        return [t('training.setFields.duration')]
      case 'distance_time':
        return [t('training.setFields.distance'), t('training.setFields.duration')]
      default:
        return []
    }
  })()
  return (
    <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
      <span className="w-6 shrink-0 text-center">#</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
      <span className="w-9 shrink-0 text-center">✓</span>
      <span className="w-7 shrink-0" />
    </div>
  )
}
