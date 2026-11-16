// Bottom sheet form to create or edit a custom exercise.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api.js'

const MUSCLES = [
  'abductors', 'abs', 'adductors', 'biceps', 'calves', 'cardio', 'delts',
  'forearms', 'glutes', 'hamstrings', 'lats', 'levator-scapulae', 'pectorals',
  'quads', 'serratus-anterior', 'spine', 'traps', 'triceps', 'upper-back',
]

const BODY_PARTS = ['arms', 'legs', 'chest', 'back', 'core', 'shoulders', 'cardio']

const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band',
  'kettlebell', 'smith', 'ez-bar', 'lever', 'sled', 'other',
]

const TRACKING_TYPES = ['weight_reps', 'reps', 'time', 'distance_time']

const MAX_SECONDARY = 5

const EMPTY = {
  name: '',
  bodyPart: '',
  muscle: '',
  secondaryMuscles: [],
  equipment: 'other',
  tracking: 'weight_reps',
}

export default function CustomExerciseSheet({ open, onClose, onCreated, initialName = '' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, name: initialName })
      setError(null)
    } else {
      setForm(EMPTY)
    }
  }, [open, initialName])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const canSubmit = form.name.trim().length > 0 && form.muscle && !saving

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: { [lang]: form.name.trim() },
        muscle: form.muscle,
        tracking: form.tracking,
        equipment: form.equipment,
      }
      if (form.bodyPart) payload.bodyPart = form.bodyPart
      if (form.secondaryMuscles.length > 0) {
        payload.secondaryMuscles = form.secondaryMuscles
      }
      const created = await api('/api/exercises', {
        method: 'POST',
        body: payload,
      })
      onCreated?.(created)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal
      aria-label={t('customExercise.title')}
    >
      <button
        type="button"
        aria-label={t('customExercise.close')}
        onClick={onClose}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        className="card-liquid relative flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-container border border-border/50 p-4 md:max-h-[85vh] md:p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-text">
              {t('customExercise.title')}
            </h2>
            <p className="mt-0.5 text-xs text-text-muted">
              {t('customExercise.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
            aria-label={t('customExercise.close')}
          >
            <svg
              width="18"
              height="18"
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

        <Field label={t('customExercise.fields.name')}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            maxLength={60}
            autoFocus
            placeholder={t('customExercise.namePlaceholder')}
            className="rounded-control border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t('customExercise.fields.muscle')} required>
            <Select
              value={form.muscle}
              onChange={(muscle) =>
                setForm((f) => ({
                  ...f,
                  muscle,
                  secondaryMuscles: f.secondaryMuscles.filter((m) => m !== muscle),
                }))
              }
              options={MUSCLES.map((m) => ({
                value: m,
                label: t(`catalog.muscles.${m}`, { defaultValue: m }),
              }))}
              placeholder={t('customExercise.selectMuscle')}
            />
          </Field>

          <Field label={t('customExercise.fields.bodyPart')}>
            <Select
              value={form.bodyPart}
              onChange={(bodyPart) => setForm((f) => ({ ...f, bodyPart }))}
              options={BODY_PARTS.map((b) => ({
                value: b,
                label: t(`catalog.bodyParts.${b}`, { defaultValue: b }),
              }))}
              placeholder={t('customExercise.selectBodyPart')}
              allowEmpty
            />
          </Field>

          <Field label={t('customExercise.fields.equipment')}>
            <Select
              value={form.equipment}
              onChange={(equipment) => setForm((f) => ({ ...f, equipment }))}
              options={EQUIPMENT.map((e) => ({
                value: e,
                label: t(`catalog.equipment.${e}`, { defaultValue: e }),
              }))}
            />
          </Field>
        </div>

        <Field
          label={t('customExercise.fields.secondary', {
            count: form.secondaryMuscles.length,
            max: MAX_SECONDARY,
          })}
          hint={t('customExercise.fields.secondaryHint')}
        >
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== form.muscle).map((m) => {
              const picked = form.secondaryMuscles.includes(m)
              const atLimit =
                !picked && form.secondaryMuscles.length >= MAX_SECONDARY
              return (
                <button
                  key={m}
                  type="button"
                  disabled={atLimit}
                  aria-pressed={picked}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      secondaryMuscles: picked
                        ? f.secondaryMuscles.filter((x) => x !== m)
                        : [...f.secondaryMuscles, m],
                    }))
                  }
                  className={`press rounded-pill border px-2.5 py-1 text-[11px] transition-[filter,transform,background-color,border-color,color] ${
                    picked
                      ? 'border-accent bg-accent/15 font-semibold text-accent'
                      : atLimit
                        ? 'cursor-not-allowed border-border/40 bg-surface/50 text-text-muted/60'
                        : 'border-border/60 bg-surface text-text-muted hover:text-text'
                  }`}
                >
                  {t(`catalog.muscles.${m}`, { defaultValue: m })}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('customExercise.fields.tracking')}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TRACKING_TYPES.map((tr) => (
              <TrackingOption
                key={tr}
                value={tr}
                checked={form.tracking === tr}
                onChange={(tracking) => setForm((f) => ({ ...f, tracking }))}
                label={t(`customExercise.tracking.${tr}.label`)}
                hint={t(`customExercise.tracking.${tr}.hint`)}
              />
            ))}
          </div>
        </Field>

        {error && (
          <p className="text-sm text-error">
            {error.payload?.message ?? error.message ?? t('customExercise.errors.generic')}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            {t('customExercise.cancel')}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? t('customExercise.saving') : t('customExercise.save')}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {hint && (
        <span className="text-[11px] normal-case text-text-muted">{hint}</span>
      )}
      {children}
    </label>
  )
}

function Select({ value, onChange, options, placeholder, allowEmpty }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-control border border-border bg-bg px-3 py-2.5 pr-9 text-sm text-text focus:border-accent focus:outline-none"
      >
        {(allowEmpty || !value) && (
          <option value="">{placeholder ?? ''}</option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

function TrackingOption({ value, checked, onChange, label, hint }) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-0.5 rounded-control border px-3 py-2.5 text-sm transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40 ${
        checked
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:bg-surface-2'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          name="tracking"
          value={value}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            checked ? 'border-accent' : 'border-border'
          }`}
        >
          {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
        </span>
        <span className={checked ? 'font-semibold text-text' : 'text-text'}>
          {label}
        </span>
      </span>
      <span className="pl-6 text-[11px] text-text-muted">{hint}</span>
    </label>
  )
}
