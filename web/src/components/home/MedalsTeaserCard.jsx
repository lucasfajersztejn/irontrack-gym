// Home teaser card linking to the medals view with a preview stack of badges.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useBadges } from '../../lib/useBadges.js'
import { ChevronRightIcon, TrophyIcon } from '../icons/NavIcons.jsx'

function Skeleton() {
  return <div className="h-24 animate-pulse rounded-container bg-surface-2" />
}

function MedalStack() {
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
