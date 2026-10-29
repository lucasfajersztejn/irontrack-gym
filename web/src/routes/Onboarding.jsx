import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const { refetch } = useUser()
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const username = value.trim().toLowerCase()
    if (!RULES.test(username)) {
      setError('3–20 caracteres, solo minúsculas, números, guion y guion bajo.')
      return
    }

    setBusy(true)
    try {
      await api('/api/me/username', { method: 'POST', body: { username } })
      await refetch()
      navigate('/home', { replace: true })
    } catch (err) {
      if (err.status === 409) {
        setError('Ese nombre ya está en uso o está reservado. Prueba otro.')
      } else if (err.status === 400 && err.payload?.issues?.[0]?.message) {
        setError(err.payload.issues[0].message)
      } else {
        setError('No se pudo guardar. Vuelve a intentarlo.')
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
            Elige tu <span className="text-accent">username</span>
          </h1>
          <p className="text-sm text-text-muted">
            Es cómo apareces en IronTrack. Único, sin espacios y en minúsculas.
            Lo podrás cambiar más adelante.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
              Username
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
            className="w-full rounded-[14px] bg-accent px-4 py-3 text-base font-semibold text-bg transition disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110 active:scale-[0.99]"
          >
            {busy ? 'Guardando…' : 'Entrar en IronTrack'}
          </button>
        </form>
      </div>
    </div>
  )
}
