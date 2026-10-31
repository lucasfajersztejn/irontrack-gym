import { useTranslation } from 'react-i18next'

/*
  Modal centrado para confirmar acciones destructivas (hoy solo "borrar
  rutina", pero genérico). El botón primario de confirmación va en rojo
  (text-error dentro de un fondo claro). El click fuera cierra sin
  confirmar — es una acción reversible, no debería requerir fricción.
*/
export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = true,
}) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        aria-label={t('routines.cancel')}
        onClick={onCancel}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />
      <div className="card-liquid relative flex w-full max-w-sm flex-col gap-3 rounded-container p-5">
        <h2 className="font-display text-lg font-semibold tracking-tight text-text">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-text-muted">{description}</p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            {t('routines.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-control px-4 py-2 text-sm font-semibold transition-[filter] ${
              destructive
                ? 'bg-error text-bg hover:brightness-[1.08]'
                : 'bg-accent text-bg hover:brightness-[1.08]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
