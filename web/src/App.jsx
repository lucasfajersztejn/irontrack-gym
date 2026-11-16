// App root: route table with lazy-loaded routes and guest/protected route wrappers.

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './routes/Landing.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'
import RouteFallback from './components/RouteFallback.jsx'

const Onboarding = lazy(() => import('./routes/Onboarding.jsx'))
const Home = lazy(() => import('./routes/Home.jsx'))
const Catalog = lazy(() => import('./routes/Catalog.jsx'))
const Routines = lazy(() => import('./routes/Routines.jsx'))
const RoutineEditor = lazy(() => import('./routes/RoutineEditor.jsx'))
const Training = lazy(() => import('./routes/Training.jsx'))
const Settings = lazy(() => import('./routes/Settings.jsx'))
const Medals = lazy(() => import('./routes/Medals.jsx'))
export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <GuestRoute>
            <Landing />
          </GuestRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute allowOnboarding>
            <Suspense fallback={<RouteFallback className="min-h-screen" />}>
              <Onboarding />
            </Suspense>
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/routines/new" element={<RoutineEditor />} />
        <Route path="/routines/:id" element={<RoutineEditor />} />
        <Route path="/training" element={<Training />} />
        <Route path="/history" element={<Navigate to="/home" replace />} />
        <Route path="/stats/week" element={<Navigate to="/home" replace />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/medals" element={<Medals />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
      </Route>
    </Routes>
  )
}
