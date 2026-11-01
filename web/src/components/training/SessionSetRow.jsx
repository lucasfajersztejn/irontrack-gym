import { useTranslation } from 'react-i18next'
import {
  perSideFromTotal,
  totalFromPerSide,
} from '../../lib/weight.js'

/*
  Fila de una serie dentro de un ejercicio. El layout cambia según el
  tracking (weight_reps, reps, time, distance_time) pero la retícula
  comparte estructura:
    [#] [input(s)] [✓] [×]
  La ✓ es grande (36×36) para pulgar con sudor; "fat finger" no debería
  marcar y desmarcar al rozar. El × es menos crítico (borrar una serie
  por accidente duele poco porque se restaura con otra +Serie).

  Modo plates (weight_reps + usesBar + barInputMode==='plates'):
    - El input muestra el peso POR LADO (derivado de weightKg total).
    - Bajo la fila se pinta un hint "60 kg · barra 20 + 2 × 20" en gris.
    - Guardamos siempre weightKg total en estado (invariante spec §4).
*/

function toNumber(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function NumberCell({ value, onChange, step = 1, min = 0, placeholder, ariaLabel }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      value={value ?? ''}
      placeholder={placeholder ?? ''}
      aria-label={ariaLabel}
      onChange={(e) => onChange(toNumber(e.target.value))}
      className="tabular w-full rounded-control border border-border bg-bg px-2 py-2 text-center text-sm text-text focus:border-accent focus:outline-none"
    />
  )
}

function CheckCell({ checked, onToggle, ariaLabel }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={`press flex h-9 w-9 shrink-0 items-center justify-center rounded-control border transition-[filter,transform,background-color,border-color] ${
        checked
          ? 'border-accent bg-accent text-bg'
          : 'border-border bg-bg text-text-muted hover:text-text'
      }`}
    >
      {checked ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 12 5 5L20 7" />
        </svg>
      ) : (
        <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
      )}
    </button>
  )
}

function DeleteCell({ onDelete, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onDelete}
      aria-label={ariaLabel}
      className="press flex h-9 w-7 shrink-0 items-center justify-center rounded-control text-text-muted transition-[filter,transform,color] hover:text-error"
    >
      <svg
        width="14"
        height="14"
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
  )
}

export default function SessionSetRow({
  index,
  set,
  tracking,
  usesBar = false,
  barInputMode = 'total',
  barKg = 0,
  onChange,
  onToggleComplete,
  onDelete,
}) {
  const { t } = useTranslation()
  const num = index + 1

  const showPlates =
    tracking === 'weight_reps' && usesBar && barInputMode === 'plates'
  const perSide = showPlates ? perSideFromTotal(set.weightKg, barKg) : null

  const onWeightChange = (val) => {
    if (showPlates) {
      // El usuario escribe perSide; recomponemos total con la barra activa.
      onChange({ weightKg: val == null ? null : totalFromPerSide(val, barKg) })
    } else {
      onChange({ weightKg: val })
    }
  }

  const body = (() => {
    switch (tracking) {
      case 'weight_reps':
        return (
          <>
            <NumberCell
              value={showPlates ? perSide : set.weightKg}
              onChange={onWeightChange}
              step={0.5}
              placeholder={showPlates ? t('training.setFields.perSide') : 'kg'}
              ariaLabel={t('training.setFields.weightAria', { n: num })}
            />
            <NumberCell
              value={set.reps}
              onChange={(reps) => onChange({ reps })}
              step={1}
              placeholder={t('training.setFields.reps')}
              ariaLabel={t('training.setFields.repsAria', { n: num })}
            />
          </>
        )
      case 'reps':
        return (
          <NumberCell
            value={set.reps}
            onChange={(reps) => onChange({ reps })}
            step={1}
            placeholder={t('training.setFields.reps')}
            ariaLabel={t('training.setFields.repsAria', { n: num })}
          />
        )
      case 'time':
        return (
          <NumberCell
            value={set.durationSec}
            onChange={(durationSec) => onChange({ durationSec })}
            step={1}
            placeholder={t('training.setFields.seconds')}
            ariaLabel={t('training.setFields.durationAria', { n: num })}
          />
        )
      case 'distance_time':
        return (
          <>
            <NumberCell
              value={set.distanceM}
              onChange={(distanceM) => onChange({ distanceM })}
              step={1}
              placeholder="m"
              ariaLabel={t('training.setFields.distanceAria', { n: num })}
            />
            <NumberCell
              value={set.durationSec}
              onChange={(durationSec) => onChange({ durationSec })}
              step={1}
              placeholder={t('training.setFields.seconds')}
              ariaLabel={t('training.setFields.durationAria', { n: num })}
            />
          </>
        )
      default:
        return null
    }
  })()

  const showTotalHint = showPlates && set.weightKg != null

  return (
    <div
      className={`flex flex-col gap-0.5 rounded-control px-2 py-1.5 transition-colors ${
        set.completed ? 'bg-accent/[0.07]' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="tabular w-6 shrink-0 text-center text-xs font-semibold text-text-muted">
          {num}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">{body}</div>
        <CheckCell
          checked={Boolean(set.completed)}
          onToggle={onToggleComplete}
          ariaLabel={t('training.setFields.completeAria', { n: num })}
        />
        <DeleteCell
          onDelete={onDelete}
          ariaLabel={t('training.setFields.deleteAria', { n: num })}
        />
      </div>
      {showTotalHint && (
        /*
          Hint sangrado: alineado con el input de peso para que el ojo baje
          en línea desde el valor por lado al total. tabular-nums evita que
          la barra avance al cambiar de 2 a 3 dígitos.
        */
        <span className="tabular ml-8 text-[10px] text-text-muted">
          {t('training.setFields.totalHint', {
            total: set.weightKg,
            bar: barKg,
            perSide,
          })}
        </span>
      )}
    </div>
  )
}
