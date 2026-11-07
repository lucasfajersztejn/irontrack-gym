import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import Avatar from './Avatar.jsx'
import Logo from './icons/Logo.jsx'
import RouteFallback from './RouteFallback.jsx'
import {
  CatalogIcon,
  HomeIcon,
  ProfileIcon,
  RoutinesIcon,
} from './icons/NavIcons.jsx'
import StartSessionFab from './StartSessionFab.jsx'

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
  Cuatro destinos: Home / Rutinas / Catálogo / Perfil. En Home vive el
  dashboard entero (lo que antes era /stats/week) + la card "Next workout"
  que elige la rutina a entrenar; /training ya no tiene sitio en el nav
  porque se arranca desde el FAB central (mobile) o el botón "Empezar" del
  sidebar (desktop). La ruta /training sigue existiendo para la pantalla
  viva de la sesión, solo no se enlaza desde aquí.
*/
const TABS = [
  { to: '/home', labelKey: 'nav.home', Icon: HomeIcon },
  { to: '/routines', labelKey: 'nav.routines', Icon: RoutinesIcon },
  { to: '/catalog', labelKey: 'nav.catalog', Icon: CatalogIcon },
  { to: '/settings', labelKey: 'nav.profile', Icon: ProfileIcon },
]

/*
  Mobile: cuatro tabs + FAB central. El FAB no es un tab (no hay destino de
  navegación simple), vive en el medio geométrico del nav con z-index por
  encima para que no lo tape el borde superior del propio navbar. Lo
  renderiza StartSessionFab con variant="fab".
*/

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

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  discord: 'Discord',
}

function providerLabel(providers) {
  if (!providers?.length) return null
  const [first] = providers
  return PROVIDER_LABELS[first] ?? first
}

export default function AppShell() {
  const { t } = useTranslation()
  const { user, linkedProviders } = useUser()
  const provider = providerLabel(linkedProviders)

  return (
    // overflow-x-hidden es un seguro global: si una card interior se le
    // va de ancho en móvil (p.ej. una fila con muchos shrink-0), el scroll
    // horizontal del viewport se traga el fixed bottom-nav y se siente
    // como si la nav "no estuviera fija". Cortar en seco aquí evita ese
    // efecto sin tener que perseguir el overflow en cada hija.
    <div className="min-h-screen overflow-x-hidden md:flex">
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
        {/* Suspense aquí dentro (y no en App.jsx) deja la sidebar y la
            bottom-nav montadas mientras llega el chunk de la ruta: al cambiar
            de pestaña solo se repinta esta área, no el layout entero. */}
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        // pb con env(safe-area-inset-bottom) para que en iPhones con
        // home-indicator la nav no quede pisada por el gesto; min
        // backup para Androids que no tienen la env var.
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/90 backdrop-blur-md md:hidden"
        aria-label={t('nav.primaryAria')}
      >
        {/*
          Repartimos los 4 tabs a ambos lados del FAB: 2 a la izquierda, 2 a
          la derecha. El FAB queda flotando sobre el navbar, elevado unos px
          para que se lea como un "botón físico" independiente, no como un
          tab más. No usa NavLink: no es un destino de navegación, es la
          acción de arrancar sesión.
        */}
        {TABS.slice(0, 2).map(({ to, labelKey, Icon }) => (
          <NavLink key={to} to={to} className={bottomLinkClass}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-accent"
                  />
                )}
                <Icon className="h-5 w-5" />
                <span>{t(labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}

        <div className="flex flex-1 items-start justify-center">
          <StartSessionFab />
        </div>

        {TABS.slice(2).map(({ to, labelKey, Icon }) => (
          <NavLink key={to} to={to} className={bottomLinkClass}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-accent"
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
