import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ExerciseCard from '../components/catalog/ExerciseCard.jsx'
import ExerciseRow from '../components/catalog/ExerciseRow.jsx'
import FilterPills from '../components/catalog/FilterPills.jsx'
import FiltersBar from '../components/catalog/FiltersBar.jsx'
import SearchInput from '../components/catalog/SearchInput.jsx'
import { useCatalog } from '../lib/useCatalog.js'

/*
  Pantalla de catálogo. Un solo estado de filtros centralizado, un solo hook
  que lo traduce a GET /api/exercises. Dos renderizaciones distintas del
  resultado:
  - Desktop: grid de ExerciseCard con GIF prominente (lectura exploratoria).
  - Mobile: lista de ExerciseRow con thumbnail (lectura rápida entre series).

  Dos árboles por breakpoint en vez de un prop responsive porque las piezas
  tienen ritmos diferentes (grid 4 col, lista 1 col densa) y mezclar lógica
  acababa en un montón de ifs anidados.

  Crear ejercicio custom queda deshabilitado con un chip "Pronto" hasta la
  próxima PR: el flujo tiene su propia pantalla y no quiero meterlo mal.
*/

function Skeleton({ className }) {
  return <div className={`animate-pulse rounded-container bg-surface-2 ${className}`} />
}

function ComingSoonChip() {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center rounded-pill border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
      {t('catalog.comingSoon')}
    </span>
  )
}

function Header({ count, loading }) {
  const { t } = useTranslation()
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
          {t('catalog.title')}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {loading ? t('catalog.loading') : t('catalog.resultCount', { count })}
        </p>
      </div>
      {/* Botón + chip como hermanos para que el chip tenga aire propio y no
          quede metido a presión contra el borde del botón deshabilitado. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-control bg-surface px-4 py-2.5 text-sm font-medium text-text-muted opacity-70"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('catalog.createCustom')}
        </button>
        <ComingSoonChip />
      </div>
    </header>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-10 text-center">
      <p className="font-display text-base font-semibold text-text">
        {t('catalog.emptyTitle')}
      </p>
      <p className="text-sm text-text-muted">{t('catalog.emptySub')}</p>
    </div>
  )
}

/*
  ErrorState: fallback cuando el GET /api/exercises revienta (red, 500,
  sesión caducada). Mensaje honesto + sugerencia de recarga. No muestra
  stack traces: el detalle del error vive en consola para debugging.
*/
function ErrorState() {
  const { t } = useTranslation()
  return (
    <div className="card-liquid flex flex-col items-center gap-3 rounded-container p-10 text-center">
      <p className="font-display text-base font-semibold text-text">
        {t('catalog.errorTitle')}
      </p>
      <p className="text-sm text-text-muted">{t('catalog.errorSub')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
      >
        {t('catalog.retry')}
      </button>
    </div>
  )
}

const PAGE_SIZE = 16

export default function Catalog() {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({
    search: '',
    bodyPart: null,
    equipment: null,
    muscle: null,
    mine: false,
  })
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { loading, error, exercises } = useCatalog(filters)

  /*
    Paginación en cliente. El backend devuelve hasta 200 ejercicios por
    combinación de filtros; mostrar los 200 de golpe satura la vista. En su
    lugar renderizamos 16 (una fila en 1 col, dos filas en 2 col, cuatro en
    4 col) y un botón "ver más" que suma 16 por clic. Cuando cambian los
    filtros, el visibleCount se reinicia: no tiene sentido conservar scroll
    cuando el set de resultados es otro.
  */
  const update = (patch) => {
    setFilters((f) => ({ ...f, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }

  const visible = useMemo(
    () => exercises.slice(0, visibleCount),
    [exercises, visibleCount],
  )
  const canLoadMore = exercises.length > visible.length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
      <Header count={exercises.length} loading={loading} />

      <div className="flex flex-col gap-3">
        <SearchInput
          value={filters.search}
          onChange={(search) => update({ search })}
        />
        <FilterPills
          value={filters.bodyPart}
          onChange={(bodyPart) => update({ bodyPart })}
        />
        <FiltersBar
          equipment={filters.equipment}
          mine={filters.mine}
          onEquipmentChange={(equipment) => update({ equipment })}
          onMineChange={(mine) => update({ mine })}
        />
      </div>

      {loading ? (
        <>
          <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
          <div className="flex flex-col gap-2 md:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </>
      ) : error ? (
        <ErrorState />
      ) : exercises.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop: grid de cards */}
          <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-3 lg:grid-cols-4">
            {visible.map((ex) => (
              <ExerciseCard key={ex._id} exercise={ex} />
            ))}
          </div>
          {/* Mobile: lista de filas */}
          <div className="flex flex-col gap-2 md:hidden">
            {visible.map((ex) => (
              <ExerciseRow key={ex._id} exercise={ex} />
            ))}
          </div>

          {canLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((n) => n + PAGE_SIZE)
                }
                className="rounded-control border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2 md:px-7 md:py-3 md:text-base"
              >
                {t('catalog.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
