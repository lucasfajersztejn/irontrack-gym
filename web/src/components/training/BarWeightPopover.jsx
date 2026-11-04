import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Popover de ajuste del peso de la barra PARA ESTA SESIÓN.

  Vive en el header del ejercicio porque el peso de la barra afecta a cómo
  se interpreta cada input de peso (en modo plates: 20 kg/lado + barra 20
  = 60 total; cambiar la barra a 15 corre la cuenta). Ponerlo per-sesión
  es la demanda real: el usuario entrena en gimnasios distintos y la barra
  cambia entre ellos; forzarle a abrir Ajustes rompe el flujo.

  Presets habituales (15 / 20 / 25 kg) + input libre con step 0.5.
  Pulsar un preset o Escape cierra; cualquier input arbitrario se confirma
  con el botón "Hecho" o perdiendo el foco al clicar fuera.

  No persiste nada per se: el componente padre llama onChange(nextKg) y
  Session.entries[i].barWeightKg se encarga de viajar al PATCH.
*/

const PRESETS = [15, 20, 25]

export default function BarWeightPopover({ value, onChange, currentKg }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setDraft(value == null ? '' : String(value))
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, value])

  function pick(kg) {
    onChange(kg)
    setOpen(false)
  }

  function commitDraft() {
    const n = Number(draft)
    if (draft === '' || Number.isNaN(n)) {
      // Entrada vacía = "volver al default global" (null en DB).
      onChange(null)
    } else {
      onChange(n)
    }
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('training.barSettings.open')}
        aria-expanded={open}
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.03a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.03a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('training.barSettings.title')}
          className="card-liquid absolute right-0 top-9 z-20 w-60 rounded-container border border-border bg-surface p-3 shadow-lg"
        >
          <p className="font-display text-[13px] font-semibold text-text">
            {t('training.barSettings.title')}
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {t('training.barSettings.current', { kg: currentKg })}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            {PRESETS.map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() => pick(kg)}
                className={`press tabular flex-1 rounded-control border px-2 py-1.5 text-xs font-semibold transition-colors ${
                  value === kg
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-bg text-text hover:bg-surface-2'
                }`}
              >
                {kg} kg
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              step={0.5}
              min={0}
              max={50}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('training.barSettings.customPlaceholder')}
              aria-label={t('training.barSettings.customAria')}
              className="tabular flex-1 rounded-control border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={commitDraft}
              className="press rounded-control border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-[filter,transform]"
            >
              {t('training.barSettings.done')}
            </button>
          </div>
          {value != null && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="press mt-2 w-full rounded-control border border-border bg-transparent px-2 py-1.5 text-[11px] text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              {t('training.barSettings.reset')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
