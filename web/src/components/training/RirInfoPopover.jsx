// Info popover explaining the RIR (reps in reserve) scale.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function RirInfoPopover() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
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
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('training.setFields.rirInfo')}
        aria-expanded={open}
        className="press flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-[10px] font-semibold text-text-muted transition-colors hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          className="card-liquid absolute right-0 top-7 z-20 w-64 rounded-container border border-border bg-surface p-3 text-xs leading-snug text-text shadow-lg"
        >
          <p className="font-display text-[13px] font-semibold text-text">
            RIR
          </p>
          <p className="mt-1 text-text-muted">
            {t('training.setFields.rirTooltip')}
          </p>
        </div>
      )}
    </div>
  )
}
