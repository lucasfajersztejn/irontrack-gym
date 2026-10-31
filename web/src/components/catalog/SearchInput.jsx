import { useTranslation } from 'react-i18next'

/*
  Input de búsqueda. Icono de lupa a la izquierda, botón "limpiar" cuando
  hay texto. El debounce vive en useCatalog, no aquí: este componente es
  controlado y plano.
*/
export default function SearchInput({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <label className="relative flex w-full items-center">
      <span className="pointer-events-none absolute left-4 text-text-muted">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('catalog.searchPlaceholder')}
        className="w-full rounded-control border border-border bg-surface py-3 pl-11 pr-10 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        aria-label={t('catalog.searchPlaceholder')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:text-text"
          aria-label={t('catalog.clearSearch')}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </label>
  )
}
