import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import Logo from './icons/Logo.jsx'
import {
  CalendarIcon,
  CatalogIcon,
  HistoryIcon,
  HomeIcon,
  KettlebellIcon,
  ProfileIcon,
  RoutinesIcon,
} from './icons/NavIcons.jsx'

/*
  Layout real de la zona autenticada.

  Desktop (md+): sidebar fijo a la izquierda. El usuario se queda viendo el
  destino actual arriba a la izquierda, el contenido respira en una columna
  centrada. Un pie con el avatar y el proveedor ancla la identidad sin
  depender de un menú escondido.

  Mobile: la sidebar desaparece y los mismos cinco destinos viven en una
  bottom-nav fija pegada al pulgar. Padding-bottom en main para que la última
  tarjeta no quede tapada bajo la nav.

  La bottom-nav estrena la variante "flotante y lumínica" que DESIGN.md
  marcaba como decisión pendiente: fondo translúcido con backdrop-blur, pero
  sin halo verde. Dos glows por pantalla (CTA + indicador de nav) rompen
  Glow-Is-Earned; el verde del CTA se queda solo. El tab activo se marca
  con una línea sólida de 2 px y text-accent, suficiente a ese tamaño.
*/

/*
  El tab Perfil apunta directamente a /settings mientras no exista pantalla
  propia: así NavLink marca el estado activo al entrar en Settings. La ruta
  /profile sigue existiendo (redirige) para que un enlace externo o un
  bookmark antiguo no caiga en 404.
*/
/*
  Siete destinos en el nav: Home / Rutinas / Entrenar / Semana / Catálogo /
  Historial / Perfil. Rutinas → Entrenar → Semana queda como "cadena del
  entreno": preparar, hacer, revisar; viven juntos para que el pulgar
  recorra el flujo sin saltos. En móvil con `text-[11px]` cabe en pantallas
  de 360 px+; si en pruebas apretamos, el candidato a mover es Perfil
  (hacia un avatar en el header).
*/
const TABS = [
  { to: '/home', labelKey: 'nav.home', Icon: HomeIcon },
  { to: '/routines', labelKey: 'nav.routines', Icon: RoutinesIcon },
  { to: '/training', labelKey: 'nav.training', Icon: KettlebellIcon },
  { to: '/stats/week', labelKey: 'nav.week', Icon: CalendarIcon },
  { to: '/catalog', labelKey: 'nav.catalog', Icon: CatalogIcon },
  { to: '/history', labelKey: 'nav.history', Icon: HistoryIcon },
  { to: '/settings', labelKey: 'nav.profile', Icon: ProfileIcon },
]

function sidebarLinkClass({ isActive }) {
  const base =
    'group flex items-center gap-3 rounded-card px-3 py-2 text-sm transition-colors'
  return isActive
    ? `${base} bg-surface-2 text-accent`
    : `${base} text-text-muted hover:text-text`
}

function bottomLinkClass({ isActive }) {
  const base =
    'relative flex flex-1 flex-col items-center gap-1 pt-2 pb-1 text-[11px] font-medium transition-colors'
  return isActive ? `${base} text-accent` : `${base} text-text-muted`
}

function providerLabel(user) {
  if (!user?.accounts?.length) return null
  const [first] = user.accounts
  const map = { google: 'Google', github: 'GitHub', microsoft: 'Microsoft', discord: 'Discord' }
  return map[first.providerId] ?? first.providerId
}

function Avatar({ user }) {
  if (user?.image) {
    return <img src={user.image} alt="" className="h-9 w-9 rounded-full object-cover" />
  }
  const initial = (user?.username ?? user?.name ?? '?').charAt(0).toUpperCase()
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-text">
      {initial}
    </span>
  )
}

export default function AppShell() {
  const { t } = useTranslation()
  const { user } = useUser()
  const provider = providerLabel(user)

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map(({ to, labelKey, Icon }) => (
            <NavLink key={to} to={to} className={sidebarLinkClass}>
              <Icon className="h-5 w-5" />
              <span>{t(labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-card bg-surface-2 px-3 py-2">
          <Avatar user={user} />
          <div className="min-w-0 text-xs leading-tight">
            <div className="truncate font-semibold text-text">
              {user?.username ?? user?.name ?? '—'}
            </div>
            {provider && (
              <div className="truncate text-text-muted">
                {t('nav.connectedWith', { provider })}
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/85 backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        {TABS.map(({ to, labelKey, Icon }) => (
          <NavLink key={to} to={to} className={bottomLinkClass}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-full bg-accent"
                  />
                )}
                <Icon className="h-5 w-5" />
                <span>{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
