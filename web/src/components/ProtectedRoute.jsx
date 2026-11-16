// Route guard: requires a session and redirects to onboarding or login as needed.

import { Navigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext.jsx'

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
