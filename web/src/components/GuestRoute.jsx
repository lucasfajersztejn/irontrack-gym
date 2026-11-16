// Route guard: redirects signed-in users away from guest-only pages.

import { Navigate } from 'react-router-dom'
import { useUser } from '../contexts/UserContext.jsx'

export default function GuestRoute({ children }) {
  const { loading, isAuthed, needsOnboarding } = useUser()

  if (loading) return null
  if (isAuthed) {
    return <Navigate to={needsOnboarding ? '/onboarding' : '/home'} replace />
  }
  return children
}
