// Editable row for one set, with inputs that depend on the exercise tracking type.

import { useTranslation } from 'react-i18next'
import {
  perSideFromTotal,
  totalFromPerSide,
} from '../../lib/weight.js'
import RirInfoPopover from './RirInfoPopover.jsx'

function toNumber(v, { min, max } = {}) {
  if (v === '' || v == null) return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
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
