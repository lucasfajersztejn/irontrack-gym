import { Navigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext.jsx'

/*
  Rutas que exigen sesión. Si falta username, el gate manda al onboarding
  antes de dejar entrar al área autenticada: así, aunque el usuario escriba
  /home a mano tras loguearse, no puede saltarse el paso.

  `allowOnboarding` existe solo para la propia /onboarding, que necesita
  sesión pero sin username; sin esa excepción, el onboarding entraría en
  bucle redirigiéndose a sí mismo.
*/
export default function ProtectedRoute({ children, allowOnboarding = false }) {
  const { loading, isAuthed, needsOnboarding } = useUser()

  if (loading) return null
  if (!isAuthed) return <Navigate to="/" replace />
  if (needsOnboarding && !allowOnboarding) {
    return <Navigate to="/onboarding" replace />
  }
  if (!needsOnboarding && allowOnboarding) {
    return <Navigate to="/home" replace />
  }
  return children
}
