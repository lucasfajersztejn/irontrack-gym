import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './routes/Landing.jsx'
import Home from './routes/Home.jsx'
import Catalog from './routes/Catalog.jsx'
import Routines from './routes/Routines.jsx'
import RoutineEditor from './routes/RoutineEditor.jsx'
import Training from './routes/Training.jsx'
import History from './routes/History.jsx'
import Settings from './routes/Settings.jsx'
import WeekStats from './routes/WeekStats.jsx'
import Onboarding from './routes/Onboarding.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'

/*
  Router dividido en tres zonas:
  - Pública (GuestRoute): la Landing. Si ya tienes sesión te manda a /home.
  - Onboarding (ProtectedRoute con allowOnboarding): necesita sesión, pero
    solo deja entrar si todavía te falta username.
  - Autenticada (ProtectedRoute + AppShell): el resto. Pintan dentro del
    layout con nav; el ProtectedRoute del shell ya se encarga de echar al
    invitado y de rebotar a /onboarding si falta username.
*/
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
            <Onboarding />
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
        <Route path="/history" element={<History />} />
        <Route path="/stats/week" element={<WeekStats />} />
        <Route path="/settings" element={<Settings />} />
        {/*
          El tab Perfil de la bottom-nav apunta a /profile para no acoplarse a
          /settings todavía. Hoy redirige: cuando el perfil tenga pantalla
          propia, basta con cambiar el destino aquí.
        */}
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
      </Route>
    </Routes>
  )
}
