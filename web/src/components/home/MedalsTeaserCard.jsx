import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBadges } from '../../lib/useBadges.js'
import { ChevronRightIcon, TrophyIcon } from '../icons/NavIcons.jsx'

/*
  Teaser del muro de medallas en Home. Es navegación, no datos: por eso se
  renderiza SIEMPRE (a diferencia de StalledCard, que se oculta sin nada que
  decir). Con 0 medallas el card invita a explorar en vez de mostrar "0/N".

  Jerarquía sin relleno sólido: el verde es acento y resplandor, nunca el
  fondo. La llamada a la acción es un borde verde + texto verde sobre una
  superficie neutra, y el anillo `ring-accent` + la mancha difusa dan el
  "primer vistazo" sin un bloque verde (ver gotcha de bg-accent en CTAs grandes).

  Si `useBadges` falla, degradamos: se muestra el card sin el número. Home
  nunca debe romperse por una petición secundaria.

  <Link> en vez de <button>: es una navegación real y así el navegador
  ofrece "abrir en pestaña nueva" y la URL es visible al hacer foco.
*/

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-container bg-surface-2" />
}

function MedalStack() {
  // Decorativo: las tres monedas no representan medallas concretas, solo
  // señalan la colección. aria-hidden para no leer ruido al lector de pantalla.
  return (
    <span aria-hidden className="relative grid h-14 w-14 shrink-0 place-items-center">
      <span className="absolute inset-0 rounded-full bg-accent/15 ring-1 ring-accent/45 motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:-rotate-6" />
      <span className="absolute inset-2 rounded-full bg-surface-2" />
      <TrophyIcon className="relative h-6 w-6 text-accent" />
    </span>
  )
}

export default function MedalsTeaserCard() {
  const { t } = useTranslation()
  const { loading, error, counts } = useBadges()

  if (loading) return <Skeleton />

  const hasData = !error && counts.total > 0
  const isEmpty = hasData && counts.unlocked === 0

  return (
    <Link
      to="/medals"
      aria-label={t('home.medalsTeaser.aria')}
      className="press group card-liquid relative flex items-center justify-between gap-4 overflow-hidden rounded-container p-4 ring-1 ring-accent/35 transition-[filter,transform] hover:brightness-110 md:p-5"
    >
      {/* Mancha de luz verde difusa tras el contenido. Es resplandor, no fondo. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative flex min-w-0 items-center gap-4">
        <MedalStack />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-text">
            {t('home.medalsTeaser.title')}
          </h2>

          {hasData && !isEmpty ? (
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-text tabular-nums">
                {counts.unlocked}
              </span>
              <span className="text-xs text-text-muted tabular-nums">
                {t('home.medalsTeaser.caption', { total: counts.total })}
              </span>
            </p>
          ) : (
            isEmpty && (
              <p className="mt-1 text-sm font-medium text-text">
                {t('home.medalsTeaser.emptyTitle')}
              </p>
            )
          )}

          <p className="mt-1 text-xs text-text-muted">
            {isEmpty
              ? t('home.medalsTeaser.emptyHint')
              : t('home.medalsTeaser.hint')}
          </p>
        </div>
      </div>

      <span className="relative flex shrink-0 items-center gap-1 rounded-control border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent">
        {t('home.medalsTeaser.cta')}
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
