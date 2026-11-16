// Confirmation modal for permanent account deletion.

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DeleteAccountModal({
  username,
  busy,
  error,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const panelRef = useRef(null)

  const openerRef = useRef(document.activeElement)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(
    () => () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    },
    [],
  )

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && !busy) {
        onCancel()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll(
        'input:not([disabled]), button:not([disabled])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])

  const typed = value.trim().replace(/^@/, '').toLowerCase()
  const matches = Boolean(username) && typed === username.toLowerCase()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-labelledby="delete-account-title"
    >
      <div
        aria-hidden
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        className="card-liquid relative flex w-full max-w-sm flex-col gap-3 rounded-container p-5"
      >
        <h2
          id="delete-account-title"
          className="font-display text-lg font-semibold tracking-tight text-text"
        >
          {t('settings.delete.modalTitle')}
        </h2>

        <p className="text-sm text-text-muted">{t('settings.delete.modalIntro')}</p>
        <ul className="flex flex-col gap-1.5 text-sm text-text-muted">
          {['sessions', 'routines', 'exercises', 'preferences', 'profile'].map(
            (item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-error">
                  •
                </span>
                {t(`settings.delete.items.${item}`)}
              </li>
            ),
          )}
        </ul>
        <p className="text-sm font-medium text-error">
          {t('settings.delete.irreversible')}
        </p>

        <label className="mt-1 block">
          <span className="mb-2 block text-xs font-medium text-text-muted">
            {t('settings.delete.confirmLabel', { username })}
          </span>
          <input
            type="text"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            placeholder={username}
            className="w-full rounded-control border border-border bg-bg px-3 py-3 text-base text-text outline-none placeholder:text-text-muted focus:border-accent disabled:opacity-60"
          />
        </label>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="press rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2 disabled:opacity-60"
          >
            {t('settings.delete.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="press rounded-control bg-error px-4 py-2 text-sm font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t('settings.delete.deleting') : t('settings.delete.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
