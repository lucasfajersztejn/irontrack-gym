import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RoutineCard from '../components/routines/RoutineCard.jsx'
import { useRoutines } from '../lib/useRoutines.js'

/*
  Pantalla "Mis rutinas". Grid de 1 a 3 columnas con las rutinas del usuario.
  Botón primario en la cabecera para crear una nueva: navega al editor con
  /routines/new, porque el backend no admite rutina vacía y necesitamos
  recoger nombre + al menos un ejercicio en el mismo paso.
*/

/*
  CTA único reutilizable para "Nueva rutina" — se usa en el header y en el
  empty state. Una sola fuente de verdad para el estilo, el icono y la copy.
*/
function NewRoutineButton() {
  const { t } = useTranslation()
  return (
    <Link
      to="/routines/new"
      className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08]"
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
      {t('routines.newRoutine')}
    </Link>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-48 rounded-card bg-surface-2" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-container bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

export default function Routines() {
  const { t } = useTranslation()
  const { loading, error, routines } = useRoutines()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
            {t('routines.title')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading
              ? t('routines.loading')
              : t('routines.countSummary', { count: routines.length })}
          </p>
        </div>
        <NewRoutineButton />
      </header>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="card-liquid flex flex-col items-center gap-3 rounded-container p-10 text-center">
          <p className="font-display text-base font-semibold text-text">
            {t('routines.errorTitle')}
          </p>
          <p className="text-sm text-text-muted">{t('routines.errorSub')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            {t('routines.retry')}
          </button>
        </div>
      ) : routines.length === 0 ? (
        <div className="card-liquid flex flex-col items-center gap-3 rounded-container p-10 text-center">
          <p className="font-display text-base font-semibold text-text">
            {t('routines.emptyListTitle')}
          </p>
          <p className="text-sm text-text-muted">{t('routines.emptyListSub')}</p>
          <div className="mt-2">
            <NewRoutineButton />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {routines.map((r) => (
            <RoutineCard key={r._id} routine={r} />
          ))}
        </div>
      )}
    </div>
  )
}
