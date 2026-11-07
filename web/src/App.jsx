import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './routes/Landing.jsx'
import GuestRoute from './components/GuestRoute.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AppShell from './components/AppShell.jsx'
import RouteFallback from './components/RouteFallback.jsx'

/*
  Router dividido en tres zonas:
  - Pública (GuestRoute): la Landing. Si ya tienes sesión te manda a /home.
  - Onboarding (ProtectedRoute con allowOnboarding): necesita sesión, pero
    solo deja entrar si todavía te falta username.
  - Autenticada (ProtectedRoute + AppShell): el resto. Pintan dentro del
    layout con nav; el ProtectedRoute del shell ya se encarga de echar al
    invitado y de rebotar a /onboarding si falta username.

  Code-splitting: cada pantalla se carga con lazy() para que el bundle inicial
  solo lleve lo que ve el primer paint. La Landing se queda eager a propósito:
  es lo primero que ve un visitante sin sesión y no queremos un spinner ahí.
  El resto solo lo ve gente logueada, así que su chunk puede llegar en la
  navegación. El Suspense de la zona autenticada vive dentro del AppShell
  (alrededor del Outlet), de modo que al cambiar de pestaña el nav no parpadea:
  solo se repinta el área de contenido.
*/
const Onboarding = lazy(() => import('./routes/Onboarding.jsx'))
const Home = lazy(() => import('./routes/Home.jsx'))
const Catalog = lazy(() => import('./routes/Catalog.jsx'))
const Routines = lazy(() => import('./routes/Routines.jsx'))
const RoutineEditor = lazy(() => import('./routes/RoutineEditor.jsx'))
const Training = lazy(() => import('./routes/Training.jsx'))
const Settings = lazy(() => import('./routes/Settings.jsx'))
// WeekStats pasa a montarse dentro de Home como <WeekDashboard />; la ruta
// /stats/week solo sobrevive como redirect a /home para no romper bookmarks.
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
        {/*
          El dashboard semanal se fusionó en Home. Dejamos las dos rutas
          históricas (/history y /stats/week) como redirects a /home para
          que bookmarks antiguos sigan funcionando.
        */}
        <Route path="/history" element={<Navigate to="/home" replace />} />
        <Route path="/stats/week" element={<Navigate to="/home" replace />} />
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
