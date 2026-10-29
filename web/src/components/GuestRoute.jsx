import { Navigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext.jsx'

/*
  Rutas accesibles solo para invitados. Si el usuario ya tiene sesión, se le
  manda a /home (o /onboarding si todavía no eligió username). Mientras
  /api/me está en vuelo renderizamos nada: la Landing parpadearía durante
  el fetch inicial si la pintáramos y luego la cambiáramos de ruta.
*/
export default function GuestRoute({ children }) {
  const { loading, isAuthed, needsOnboarding } = useUser()

  if (loading) return null
  if (isAuthed) {
    return <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
  }
  return children
}
