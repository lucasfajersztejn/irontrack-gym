/*
  Iconos de la nav real y del dashboard Home. Mantener trazo 1.8 y
  stroke-linecap round en todos para que lean como una familia; usar
  currentColor para que un solo prop `className` cambie color (text-accent
  en el tab activo, text-text-muted en el resto). Si en algún momento
  Claude Design entrega SVGs definitivos, se sustituyen uno a uno.
*/

const baseProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export function HomeIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  )
}

export function RoutinesIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

export function CatalogIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
    </svg>
  )
}

export function HistoryIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function ProfileIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

/*
  KettlebellIcon: el icono de entrenar. Descartamos la mancuerna porque su
  silueta (dos barras verticales + barra horizontal) coincide con la del
  CatalogIcon y en el nav bar las dos leían como el mismo tab. La kettlebell
  tiene silueta propia: asa de arco arriba + cuello corto + cuerpo redondo
  abajo. Trazo 1.8 round como el resto para que se mantenga en familia.
*/
export function KettlebellIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      {/* Asa (arco superior) */}
      <path d="M9 7.5a3 3 0 0 1 6 0" />
      {/* Cuello: dos trazos cortos del asa al cuerpo */}
      <path d="M9 7.5v1.2M15 7.5v1.2" />
      {/* Cuerpo (círculo) */}
      <circle cx="12" cy="14.5" r="5" />
    </svg>
  )
}

export function PlayIcon({ className = '' }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  )
}

export function FlameIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C10.5 6 11.5 4.5 12 3Z" />
      <path d="M9.5 15a2.5 2.5 0 0 0 5 0" />
    </svg>
  )
}

export function CalendarIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function TrophyIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a2 2 0 0 0 3 4M16 6h3a2 2 0 0 1-3 4" />
      <path d="M10 14h4l1 4H9z" />
      <path d="M8 20h8" />
    </svg>
  )
}

export function ChevronRightIcon({ className = '' }) {
  return (
    <svg {...baseProps} className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
