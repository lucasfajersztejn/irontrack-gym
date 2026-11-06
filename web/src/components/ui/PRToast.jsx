import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Toast de récord personal. Vive al nivel de SessionLiveView, se dispara al
  marcar ✓ en una serie que supera la marca histórica. Receta UX:

  - Una sola pila: el caller mantiene un array y empuja; cada toast se
    auto-oculta a los TTL_MS. Cancelamos el timer al desmontar para no
    arrastrar un setState sobre un árbol vivo tras cambiar de pantalla.
  - Sin animación cuando el usuario prefiere reduced motion (spec §7).
  - No bloquea tap: pointer-events-none en el contenedor, auto en la burbuja
    para dar lugar al botón de cerrar.
  - Posición fija arriba a propósito. El flujo del entreno mira al centro
    de la pantalla; aparecer al fondo colisiona con la RestTimerBar.
*/

const TTL_MS = 4000

export function PRToastStack({ toasts, onDismiss }) {
  return (
    <div
      // paddingTop vía safe-area env(): respeta el notch en iOS sin
      // incluir un plugin extra de Tailwind para ello.
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
      aria-atomic
    >
      {toasts.map((toast) => (
        <PRToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function PRToast({ toast, onDismiss }) {
  const { t, i18n } = useTranslation()
  useEffect(() => {
    const id = setTimeout(() => onDismiss(toast.id), TTL_MS)
    return () => clearTimeout(id)
  }, [toast.id, onDismiss])

  const value = (() => {
    // Formateo mínimo: kg con un decimal cuando viene con fracción, reps
    // enteros. tabular-nums de Tailwind 4 vive en el token `tabular` global.
    const fmt = new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
    if (toast.kind === 'bestReps') return t('training.pr.reps', { n: toast.value })
    if (toast.kind === 'best1RM') {
      return t('training.pr.oneRm', { kg: fmt.format(toast.value) })
    }
    return t('training.pr.heaviest', { kg: fmt.format(toast.value) })
  })()

  return (
    <div
      role="status"
      className="pointer-events-auto flex min-w-0 max-w-sm items-center gap-3 rounded-container border border-accent/40 bg-surface px-4 py-3 shadow-glow-landing"
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
      >
        {/* Trofeo mínimo inline — ya existe TrophyIcon en NavIcons pero
            depender aquí añade un re-export cíclico; una copia de 20 líneas
            vale más que la abstracción prematura. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z" />
          <path d="M17 6h2a2 2 0 0 1 0 4h-2M7 6H5a2 2 0 0 0 0 4h2" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-text">
          {t('training.pr.title')}
        </p>
        <p className="truncate text-xs text-text-muted">
          <span className="text-text">{toast.exerciseName}</span>
          {' · '}
          <span className="tabular">{value}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('training.pr.dismiss')}
        className="press rounded-full p-1 text-text-muted hover:text-text"
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
    </div>
  )
}

export default PRToast
