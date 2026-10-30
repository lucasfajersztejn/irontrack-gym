import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CatalogIcon,
  ChevronRightIcon,
  HistoryIcon,
  RoutinesIcon,
} from '../icons/NavIcons.jsx'

/*
  Columna de accesos rápidos. En desktop lista vertical dentro de una
  container card (coincide con el mockup); en móvil, tres tiles cuadrados
  en fila con icono grande + label (más corto y pulgar-friendly). El prop
  `variant` elige layout.
*/

function links(t, routinesCount) {
  return [
    {
      to: '/routines',
      label: t('home.quickAccessRoutines'),
      sub: t('home.quickAccessRoutinesSub', { count: routinesCount }),
      Icon: RoutinesIcon,
    },
    {
      to: '/catalog',
      label: t('home.quickAccessCatalog'),
      sub: t('home.quickAccessCatalogSub'),
      Icon: CatalogIcon,
    },
    {
      to: '/history',
      label: t('home.quickAccessHistory'),
      sub: t('home.quickAccessHistorySub'),
      Icon: HistoryIcon,
    },
  ]
}

export default function QuickAccessList({ variant = 'list', routinesCount = 0 }) {
  const { t } = useTranslation()
  const items = links(t, routinesCount)

  if (variant === 'tiles') {
    return (
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="card-liquid flex flex-col items-start gap-3 rounded-container p-4 text-sm text-text transition-[filter] hover:brightness-[1.1]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-bg text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
    )
  }

  /*
    Variant list: la card es un contenedor; dentro, cada ítem reparte
    espacio con flex-1 para que los tres se distribuyan a la altura total
    del panel. Así el panel queda del alto de "Últimas sesiones" sin que
    los ítems queden colgando arriba.
  */
  return (
    <div className="card-liquid flex h-full flex-col gap-2 rounded-container p-2">
      {items.map(({ to, label, sub, Icon }) => (
        <Link
          key={to}
          to={to}
          className="group flex flex-1 items-center gap-3 rounded-card px-3 py-3 transition-colors hover:bg-surface-2"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-bg text-accent">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-text">{label}</span>
            <span className="block truncate text-xs text-text-muted">{sub}</span>
          </span>
          <ChevronRightIcon className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
      ))}
    </div>
  )
}
