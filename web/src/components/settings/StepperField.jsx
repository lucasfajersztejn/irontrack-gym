// Numeric settings field with minus/plus stepper and typed input.

import { useId, useState } from 'react'

export default function StepperField({
  label,
  helper,
  value,
  min,
  max,
  step,
  suffix,
  decLabel,
  incLabel,
  onChange,
  error,
}) {
  const labelId = useId()
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)

  if (value !== lastValue) {
    setLastValue(value)
    setDraft(String(value))
  }

  function clamp(n) {
    return Math.min(max, Math.max(min, n))
  }

  function commit() {
    const parsed = Number(String(draft).replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clamp(parsed)
    setDraft(String(next))
    onChange(next)
  }

  function nudge(delta) {
    const next = clamp(Math.round((value + delta) * 100) / 100)
    setDraft(String(next))
    onChange(next)
  }

  const buttonClass =
    'press flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-lg font-semibold text-text transition-[filter,transform,background-color] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-text">
          {label}
        </p>
        {helper && (
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{helper}</p>
        )}
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        className="flex shrink-0 items-center gap-1 self-start rounded-control bg-bg p-1 md:self-auto"
      >
        <button
          type="button"
          onClick={() => nudge(-step)}
          disabled={value <= min}
          aria-label={decLabel}
          className={buttonClass}
        >
          −
        </button>

        <label className="flex items-baseline gap-1">
          <span className="sr-only">{label}</span>
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            className="tabular w-12 rounded-card bg-transparent py-2 text-center font-display text-base font-semibold text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {suffix && (
            <span aria-hidden className="text-xs text-text-muted">
              {suffix}
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => nudge(step)}
          disabled={value >= max}
          aria-label={incLabel}
          className={buttonClass}
        >
          +
        </button>
      </div>
    </div>
  )
}
