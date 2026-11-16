// App layout shell: sidebar on desktop, bottom tab bar on mobile, wrapping the routed page.

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

const TABS = [
  { to: '/home', labelKey: 'nav.home', Icon: HomeIcon },
  { to: '/routines', labelKey: 'nav.routines', Icon: RoutinesIcon },
  { to: '/catalog', labelKey: 'nav.catalog', Icon: CatalogIcon },
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

const PROVIDER_LABELS = {
  google: 'Google',
  github: 'GitHub',
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
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/90 backdrop-blur-md md:hidden"
        aria-label={t('nav.primaryAria')}
      >
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
