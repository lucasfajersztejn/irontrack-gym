import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api.js'
import { useUser } from '../contexts/UserContext.jsx'
import Logo from '../components/icons/Logo.jsx'

/*
  Primer login: elegir username. Las reglas las impone el backend con Zod
  (minúsculas, 3-20, [a-z0-9_-], lista de reservados). Replicamos las más
  obvias para feedback inmediato, pero cualquier violación la mostramos tal
  como venga del servidor para no mantener dos verdades. Reservados y
  duplicados responden 409; validación de forma, 400.
*/

const RULES = /^[a-z0-9_-]{3,20}$/

export default function Onboarding() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { refetch } = useUser()
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const username = value.trim().toLowerCase()
    if (!RULES.test(username)) {
      setError(t('onboarding.errors.format'))
      return
    }

    setBusy(true)
    try {
      await api('/api/me/username', { method: 'POST', body: { username } })
      await refetch()
      navigate('/home', { replace: true })
    } catch (err) {
      if (err.status === 409) {
        setError(t('onboarding.errors.taken'))
      } else if (err.status === 400 && err.payload?.issues?.[0]?.message) {
        // Mensaje de forma del backend: lo mostramos tal cual para no mantener
        // dos verdades sobre las reglas de username (ver cabecera del archivo).
        setError(err.payload.issues[0].message)
      } else {
        setError(t('onboarding.errors.generic'))
      }
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-6 pt-10 pb-10">
        <Logo />

        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('onboarding.titleBefore')}{' '}
            <span className="text-accent">username</span>
          </h1>
          <p className="text-sm text-text-muted">
            {t('onboarding.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
              {t('onboarding.usernameLabel')}
            </span>
            <div className="flex items-center overflow-hidden rounded-[14px] border border-border bg-surface focus-within:border-accent">
              <span className="pl-4 text-text-muted">@</span>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                autoCapitalize="off"
                autoComplete="off"
                spellCheck={false}
                placeholder="lucas"
                className="flex-1 bg-transparent px-2 py-3 text-base text-text outline-none placeholder:text-text-muted"
                maxLength={20}
              />
            </div>
          </label>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="w-full rounded-[14px] bg-accent px-4 py-3 text-base font-semibold text-bg transition disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-px hover:brightness-110 active:scale-[0.99]"
          >
            {busy ? t('onboarding.saving') : t('onboarding.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
