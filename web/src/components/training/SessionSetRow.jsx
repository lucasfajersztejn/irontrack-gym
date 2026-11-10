import { useTranslation } from 'react-i18next'
import {
  perSideFromTotal,
  totalFromPerSide,
} from '../../lib/weight.js'
import RirInfoPopover from './RirInfoPopover.jsx'

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

function toNumber(v, { min, max } = {}) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
  // Los atributos HTML min/max solo marcan el input como :invalid, no impiden
  // escribir fuera de rango. El backend sí valida (p.ej. RIR 0-5), así que
  // clampamos aquí para que el PATCH nunca mande algo que sabemos que va a
  // volver como 400.
  if (max != null && n > max) return max
  if (min != null && n < min) return min
  return n
}

function NumberCell({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  placeholder,
  ariaLabel,
  className = 'w-full',
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      value={value ?? ''}
      placeholder={placeholder ?? ''}
      aria-label={ariaLabel}
      onChange={(e) => onChange(toNumber(e.target.value, { min, max }))}
      className={`tabular ${className} rounded-control border border-border bg-bg px-2 py-2 text-center text-sm text-text focus:border-accent focus:outline-none`}
    />
  )
}

/*
  Celda RIR + (i) de ayuda. El popover solo se monta en la primera serie del
  entry (prop `showInfo`) para no apilar tres botones i idénticos cuando hay
  3 series: un solo explicador por columna basta. En las series siguientes
  reservamos el hueco del botón con un spacer invisible para que la columna
  de inputs mantenga la misma anchura en todas las filas.
*/
function RirCell({ value, onChange, showInfo, ariaLabel }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <NumberCell
        value={value}
        onChange={onChange}
        step={1}
        min={0}
        max={5}
        placeholder="RIR"
        ariaLabel={ariaLabel}
        className="w-14"
      />
      {showInfo ? (
        <RirInfoPopover />
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden />
      )}
    </div>
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
  suggestion = null,
  onChange,
  onToggleComplete,
  onDelete,
}) {
  const { t } = useTranslation()
  const num = index + 1

  const showPlates =
    tracking === 'weight_reps' && usesBar && barInputMode === 'plates'
  const perSide = showPlates ? perSideFromTotal(set.weightKg, barKg) : null

  /*
    Placeholders de sugerencia. Llega YA en la unidad de este input (por
    lado en modo discos, total si no): la conversión la hace el card, que
    es quien sabe el peso de la barra. Aquí solo se pinta.

    Si no hay sugerencia se cae al placeholder genérico de siempre.
  */
  const weightPlaceholder =
    suggestion?.weightKg != null
      ? String(suggestion.weightKg)
      : showPlates
        ? t('training.setFields.perSide')
        : 'kg'

  const repsPlaceholder =
    suggestion?.reps != null
      ? String(suggestion.reps)
      : t('training.setFields.reps')

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
              placeholder={weightPlaceholder}
              ariaLabel={t('training.setFields.weightAria', { n: num })}
            />
            <NumberCell
              value={set.reps}
              onChange={(reps) => onChange({ reps })}
              step={1}
              placeholder={repsPlaceholder}
              ariaLabel={t('training.setFields.repsAria', { n: num })}
            />
            <RirCell
              value={set.rir}
              onChange={(rir) => onChange({ rir })}
              showInfo={index === 0}
              ariaLabel={t('training.setFields.rirAria', { n: num })}
            />
          </>
        )
      case 'reps':
        return (
          <>
            <NumberCell
              value={set.reps}
              onChange={(reps) => onChange({ reps })}
              step={1}
              placeholder={t('training.setFields.reps')}
              ariaLabel={t('training.setFields.repsAria', { n: num })}
            />
            <RirCell
              value={set.rir}
              onChange={(rir) => onChange({ rir })}
              showInfo={index === 0}
              ariaLabel={t('training.setFields.rirAria', { n: num })}
            />
          </>
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

  /*
    Hint SIEMPRE visible en ejercicios con barra cuando ya se ha anotado un
    peso. En modo plates (el input pide "x lado") el hint remata con el
    total — "20 kg × 2 + barra 20 = 60 kg". En modo total (el input pide
    kg totales) el hint hace la conversión inversa a lado — "60 kg = 20 kg
    × 2 + barra 20". Misma info, dirección distinta según lo que el usuario
    está escribiendo.
  */
  const showTotalHint =
    tracking === 'weight_reps' && usesBar && set.weightKg != null
  const totalPerSide = showTotalHint
    ? (perSide ?? perSideFromTotal(set.weightKg, barKg))
    : null

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
            perSide: totalPerSide,
          })}
        </span>
      )}
    </div>
  )
}
