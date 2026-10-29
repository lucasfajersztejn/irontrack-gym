import { NavLink, Outlet } from 'react-router-dom'
import Logo from './icons/Logo.jsx'

/*
  Layout de las rutas autenticadas. De momento sirve como contenedor con una
  nav de desarrollo para saltar entre las pantallas: cuando llegue el mockup
  de Home se sustituirá por el bottom-nav real en móvil y side-nav en
  desktop. Sin esta separación, la Landing arrastraría la nav de dev y no
  parecería una landing.
*/
const links = [
  { to: '/home', label: 'Home' },
  { to: '/catalog', label: 'Catálogo' },
  { to: '/routines', label: 'Rutinas' },
  { to: '/training', label: 'Entrenar' },
  { to: '/history', label: 'Historial' },
  { to: '/settings', label: 'Ajustes' },
]

export default function AppShell() {
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-4 border-b border-border bg-surface px-4 py-3">
        <Logo />
        <nav className="flex flex-wrap gap-2 text-sm">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `rounded-card px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-accent text-bg'
                    : 'text-text-muted hover:text-text'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
