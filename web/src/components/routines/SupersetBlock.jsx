import { useTranslation } from 'react-i18next'

/*
  Wrapper visual para un bloque de superserie. Dos ejercicios o más del
  mismo groupId se renderizan dentro.

  Lenguaje visual:
  - Borde izquierdo acento (verde) + chip "SUPERSET" arriba: comunica
    jerarquía sin ocupar una card entera. El borde cose las filas
    verticalmente de forma barata (nada de wrappers nested).
  - Botón "Separar" discreto en la cabecera del bloque.

  No gestiona el estado del grupo: recibe `onUngroup` para desvincular todo
  el bloque y los hijos (las filas) ya tienen sus propios handlers.
*/
export default function SupersetBlock({ children, onUngroup }) {
  const { t } = useTranslation()
  return (
    <section className="relative rounded-container border-l-2 border-accent/70 pl-3">
      <header className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-pill bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {t('routines.supersetTag')}
        </span>
        {onUngroup && (
          <button
            type="button"
            onClick={onUngroup}
            className="press rounded-pill border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
          >
            {t('routines.unlinkSuperset')}
          </button>
        )}
      </header>
      {/*
        Gap reducido entre filas del bloque (gap-1 vs gap-2 fuera): el borde
        izquierdo las cose; apretar la separación refuerza la idea de "esto
        es un bloque único".
      */}
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  )
}
