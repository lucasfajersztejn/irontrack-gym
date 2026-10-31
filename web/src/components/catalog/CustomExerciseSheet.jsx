import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api.js'

/*
  Hoja secundaria para crear un ejercicio custom sin salir del contexto.
  Vive como pieza compartida porque la invocan dos sitios con el mismo
  contrato: el header del catálogo (crear → recarga el listado) y el picker
  de la rutina (crear → auto-seleccionar y cerrar). Centralizar aquí evita
  mantener dos formularios paralelos que acabarían divergiendo.

  Decisiones de alcance (Fase 1):
  - Un solo idioma en el nombre: el que esté activo en i18n. Pedir ES+EN para
    "press loco de Juan" es fricción injustificada; el backend acepta uno de
    los dos (localizedNameSchema).
  - Sin instructions ni secondaryMuscles: campos de power-user que llegarán
    cuando exista una vista de edición dedicada.
  - Tracking como radio en lugar de select: son 4 opciones con significados
    muy distintos y el radio los pone todos a la vista; un select los
    esconde detrás de un click y obliga a leer el label activo para saber
    qué está pasando.
  - z-50 igual que el picker; el padre decide cuál monta primero. El overlay
    propio con backdrop-blur cubre el picker si se abre desde allí, dando
    la jerarquía visual correcta sin tener que gestionar un stack de z-index.
*/

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

const EMPTY = {
  name: '',
  bodyPart: '',
  muscle: '',
  equipment: 'other',
  tracking: 'weight_reps',
}

export default function CustomExerciseSheet({ open, onClose, onCreated, initialName = '' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Al abrir, resetear y prellenar con el término buscado (si vino).
  // Al cerrar también limpiamos para que la próxima apertura arranque virgen
  // sin ver un parpadeo del estado anterior durante la animación de salida.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, name: initialName })
      setError(null)
    } else {
      setForm(EMPTY)
    }
  }, [open, initialName])

  // Bloquear scroll del fondo mientras la hoja está abierta.
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
              onChange={(muscle) => setForm((f) => ({ ...f, muscle }))}
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

        <Field label={t('customExercise.fields.tracking')}>
          {/*
            Radio en lugar de select: cuatro opciones semánticamente muy
            distintas (peso×reps / solo reps / tiempo / distancia+tiempo).
            Tenerlas a la vista acelera la decisión y evita confusiones.
          */}
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

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </span>
      {children}
    </label>
  )
}

/*
  Select nativo pero estilado con los tokens del sistema. Nativo porque:
  (1) accesibilidad gratis en móvil (picker del sistema operativo), (2) no
  justifica un combobox custom con 12 opciones ordenadas. El look dark se
  consigue heredando los colores del token y el chevron se pinta con
  background-image SVG para que no quede la flechita blanca por defecto.
*/
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
