import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import {
  barWeightFor,
  perSideFromTotal,
  shouldShowBarWeightInput,
  shouldShowPerSide,
  totalFromPerSide,
} from '../../lib/weight.js'

/*
  Fila del editor. Dos niveles de campos:

  - **Primarios** (fila grande): lo que vale la pena planificar en una
    plantilla — series, y en los ejercicios de peso también el peso de
    arranque. Las repeticiones no entran aquí: en la vida real las reps
    varían serie a serie dentro de una sesión; comprometerse a un número
    en la plantilla es ficción.
  - **Secundarios** (debajo, más tenues): "Reps objetivo (opcional)" para
    quien quiera marcar una meta — útil en bloques de fuerza con un número
    cerrado, no obligatorio para quien va a RIR libre.

  El input de peso respeta `user.settings.barInputMode`: si el ejercicio
  usa barra y el modo es 'plates', mostramos "Discos por lado" con una
  línea helper que delata el total y la composición de la barra. El
  invariante de almacenamiento se preserva: lo que viaja al backend es
  siempre total en kg.
*/

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  tone = 'primary',
}) {
  const sizes =
    tone === 'secondary'
      ? 'py-1.5 text-xs'
      : 'py-2 text-sm'
  const labelClass =
    tone === 'secondary'
      ? 'text-[10px] text-text-muted'
      : 'text-xs text-text-muted'
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? null : Number(e.target.value))
          }
          step={step}
          min={min}
          className={`tabular w-full rounded-control border border-border bg-bg pl-3 pr-7 text-text focus:border-accent focus:outline-none ${sizes}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

function WeightField({ entry, onChange, barMode, userBarKg }) {
  const { t } = useTranslation()
  const perSide = shouldShowPerSide(entry.exercise, barMode)
  const barKg = barWeightFor(entry.exercise, entry.barWeightKg, userBarKg)

  if (!perSide) {
    return (
      <NumberField
        label={t('routines.fields.weight')}
        suffix="kg"
        step={0.5}
        value={entry.targetWeightKg}
        onChange={(targetWeightKg) => onChange({ ...entry, targetWeightKg })}
      />
    )
  }

  /*
    Cuando el usuario cambia el peso de la barra, el "total" guardado se
    recompone a partir del valor por lado visible: el usuario ha dicho
    "quiero 20 kg por lado"; cambiar de barra de 20 a 15 no debe mover
    los discos, debe mover el total (nueva total = 20 × 2 + 15 = 55).
  */
  const visible = perSideFromTotal(entry.targetWeightKg, barKg)
  const handlePlatesChange = (plates) => {
    const total = totalFromPerSide(plates, barKg)
    onChange({ ...entry, targetWeightKg: total })
  }
  const handleBarChange = (newBarKg) => {
    if (visible != null) {
      const total = totalFromPerSide(visible, newBarKg ?? 20)
      onChange({ ...entry, barWeightKg: newBarKg, targetWeightKg: total })
    } else {
      onChange({ ...entry, barWeightKg: newBarKg })
    }
  }

  const showBarInput = shouldShowBarWeightInput(entry.exercise)

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`grid gap-2 ${showBarInput ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'}`}
      >
        <NumberField
          label={t('routines.fields.perSide')}
          suffix="kg"
          step={0.5}
          value={visible}
          onChange={handlePlatesChange}
        />
        {showBarInput && (
          <div className="w-20">
            <NumberField
              label={t('routines.fields.barWeight')}
              suffix="kg"
              step={0.5}
              value={entry.barWeightKg}
              onChange={handleBarChange}
            />
          </div>
        )}
      </div>
      {entry.targetWeightKg != null && (
        <span className="text-[10px] leading-tight text-text-muted">
          {t('routines.fields.totalHint', {
            total: entry.targetWeightKg,
            bar: barKg,
            perSide: visible,
          })}
        </span>
      )}
    </div>
  )
}

function PrimaryFields({ entry, onChange, barMode, userBarKg }) {
  const { t } = useTranslation()
  const set = (patch) => onChange({ ...entry, ...patch })
  const sets = (
    <NumberField
      label={t('routines.fields.sets')}
      value={entry.targetSets}
      onChange={(targetSets) => set({ targetSets })}
    />
  )

  switch (entry.exercise.tracking) {
    case 'weight_reps':
      return (
        <div className="grid grid-cols-2 gap-2">
          {sets}
          <WeightField
            entry={entry}
            onChange={onChange}
            barMode={barMode}
            userBarKg={userBarKg}
          />
        </div>
      )
    case 'reps':
      return <div className="grid grid-cols-1 gap-2">{sets}</div>
    case 'time':
      return (
        <div className="grid grid-cols-2 gap-2">
          {sets}
          <NumberField
            label={t('routines.fields.duration')}
            suffix={t('routines.fields.seconds')}
            value={entry.targetDurationSec}
            onChange={(targetDurationSec) => set({ targetDurationSec })}
          />
        </div>
      )
    case 'distance_time':
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={t('routines.fields.distance')}
            suffix="m"
            value={entry.targetDistanceM}
            onChange={(targetDistanceM) => set({ targetDistanceM })}
          />
          <NumberField
            label={t('routines.fields.duration')}
            suffix={t('routines.fields.seconds')}
            value={entry.targetDurationSec}
            onChange={(targetDurationSec) => set({ targetDurationSec })}
          />
        </div>
      )
    default:
      return sets
  }
}

function SecondaryFields({ entry, onChange }) {
  const { t } = useTranslation()
  // Reps objetivo opcional solo tiene sentido cuando el ejercicio registra
  // reps (weight_reps o reps). Para time y distance_time no aplica.
  if (!['weight_reps', 'reps'].includes(entry.exercise.tracking)) return null
  return (
    <NumberField
      tone="secondary"
      label={t('routines.fields.repsOptional')}
      value={entry.targetReps}
      onChange={(targetReps) => onChange({ ...entry, targetReps })}
    />
  )
}

export default function ExerciseEditorRow({
  entry,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const barMode = user?.settings?.barInputMode ?? 'plates'
  const userBarKg = user?.settings?.defaultBarWeightKg ?? 20

  const { exercise } = entry
  const name =
    exercise.name?.[i18n.language] ?? exercise.name?.es ?? exercise.name?.en ?? '—'

  return (
    <article className="card-liquid flex flex-col gap-3 rounded-container p-3 md:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight text-text">
            {name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              {t(`catalog.muscles.${exercise.muscle}`, {
                defaultValue: exercise.muscle,
              })}
            </span>
            <span className="text-[11px] text-text-muted">
              {t(`catalog.equipment.${exercise.equipment}`, {
                defaultValue: exercise.equipment,
              })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={t('routines.moveUp')}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
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
              <path d="m18 15-6-6-6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={t('routines.moveDown')}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30"
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
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('routines.removeExercise')}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-error"
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
      <PrimaryFields
        entry={entry}
        onChange={onChange}
        barMode={barMode}
        userBarKg={userBarKg}
      />
      <SecondaryFields entry={entry} onChange={onChange} />
    </article>
  )
}
