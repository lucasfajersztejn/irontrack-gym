import { NavLink, Route, Routes } from 'react-router-dom'
import Landing from './routes/Landing.jsx'
import Home from './routes/Home.jsx'
import Catalog from './routes/Catalog.jsx'
import Routines from './routes/Routines.jsx'
import Training from './routes/Training.jsx'
import History from './routes/History.jsx'
import Settings from './routes/Settings.jsx'
import Onboarding from './routes/Onboarding.jsx'

/*
  Router raíz con rutas placeholder. La estructura final tendrá un layout
  autenticado (bottom-nav en móvil, side-nav en desktop) envolviendo
  Home/Catalog/Routines/Training/History/Settings, y Landing/Onboarding
  por fuera. De momento todas las rutas son hermanas para poder validar
  el toolchain antes de entrar en navegación real.
*/

const links = [
  { to: '/', label: 'Landing' },
  { to: '/home', label: 'Home' },
  { to: '/catalog', label: 'Catálogo' },
  { to: '/routines', label: 'Rutinas' },
  { to: '/training', label: 'Entrenar' },
  { to: '/history', label: 'Historial' },
  { to: '/settings', label: 'Ajustes' },
  { to: '/onboarding', label: 'Onboarding' },
]

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="flex flex-wrap gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `rounded-[var(--radius-card)] px-3 py-1.5 transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent)] text-[var(--color-bg)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-5xl p-6">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/training" element={<Training />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </main>
    </div>
  )
}
