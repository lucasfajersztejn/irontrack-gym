import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth.js'
import { useUser } from '../contexts/UserContext.jsx'

export default function Settings() {
  const navigate = useNavigate()
  const { user, refetch } = useUser()

  async function handleSignOut() {
    await signOut()
    await refetch()
    navigate('/', { replace: true })
  }

  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl">Ajustes</h1>
      <p className="text-text-muted">
        Idioma, unidades, barra por defecto, cerrar sesión, borrar cuenta.
      </p>

      {user && (
        <div className="rounded-container bg-surface p-6">
          <p className="text-sm text-text-muted">Sesión activa</p>
          <p className="mt-1 text-lg font-semibold">@{user.username}</p>
          <p className="text-sm text-text-muted">{user.email}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-4 rounded-[14px] border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-text hover:border-error hover:text-error"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </section>
  )
}
