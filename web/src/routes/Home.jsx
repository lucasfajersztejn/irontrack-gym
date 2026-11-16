// Home route: dashboard of weekly goal, stats, heatmap, records and workout cards.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GreetingHeader from '../components/home/GreetingHeader.jsx'
import NextWorkoutCard from '../components/home/NextWorkoutCard.jsx'
import RecentPrsCard from '../components/home/RecentPrsCard.jsx'
import RecordsCard from '../components/home/RecordsCard.jsx'
import SelectedWorkoutCard from '../components/home/SelectedWorkoutCard.jsx'
import StalledCard from '../components/home/StalledCard.jsx'
import StatTile from '../components/home/StatTile.jsx'
import ActivityHeatmap from '../components/home/ActivityHeatmap.jsx'
import MedalsTeaserCard from '../components/home/MedalsTeaserCard.jsx'
import WeekDashboard from './WeekStats.jsx'
import {
  CalendarIcon,
  FlameIcon,
  TrophyIcon,
} from '../components/icons/NavIcons.jsx'
import { useUser } from '../contexts/UserContext.jsx'
import { useHomeData } from '../lib/useHomeData.js'
import { resolveExerciseName } from '../lib/exerciseName.js'
import { useAvailableHeatmapRanges, useHeatmap } from '../lib/useHeatmap.js'

const DEFAULT_WEEKLY_GOAL = 4

function kgFormat(kg, locale) {
  if (!kg) return '—'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kg)
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-card bg-surface-2 ${className}`} />
}

function SectionHeading({ children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
        {children}
      </h2>
      <span
        aria-hidden
        className="h-[2px] w-10 rounded-full bg-accent/70"
      />
    </div>
  )
}

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const data = useHomeData()
  const [heatmapRange, setHeatmapRange] = useState('12w')
  const heatmap = useHeatmap(heatmapRange)
  const availableRanges = useAvailableHeatmapRanges()
  const weeklyGoal = user?.settings?.weeklyGoal ?? DEFAULT_WEEKLY_GOAL

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 md:gap-10">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:items-start md:gap-6">
        <div className="md:col-span-1">
          <GreetingHeader />
        </div>
        <div className="md:col-span-2">
          {data.loading ? (
            <Skeleton className="h-40" />
          ) : (
            <NextWorkoutCard
              routines={data.routines}
              suggestedRoutine={data.suggestedRoutine}
              activeSession={data.activeSession}
            />
          )}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>{t('home.perfBlock')}</SectionHeading>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
          {data.loading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32 md:col-span-2" />
            </>
          ) : (
            <>
              <StatTile
                index={0}
                icon={<TrophyIcon className="h-4 w-4" />}
                label={t('home.oneRm')}
                value={kgFormat(data.oneRm?.kg, i18n.language)}
                suffix={data.oneRm ? 'kg' : null}
                footer={
                  data.oneRm ? (
                    <span className="block truncate text-xs text-text-muted">
                      {resolveExerciseName(
                        data.oneRm,
                        user?.exerciseAliases ?? null,
                        i18n.language?.startsWith('en') ? 'en' : 'es',
                      )}
                    </span>
                  ) : null
                }
              />
              <div className="md:col-span-2">
                <RecentPrsCard />
              </div>
            </>
          )}
        </div>
      </section>

      <RecordsCard />

      <StalledCard />

      <section className="flex flex-col gap-3">
        <SectionHeading>{t('home.activityBlock')}</SectionHeading>
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {data.loading ? (
            <>
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </>
          ) : (
            <>
              <StatTile
                size="lg"
                index={0}
                icon={<FlameIcon className="h-4 w-4" />}
                label={t('home.streak')}
                value={data.streak || '—'}
                suffix={data.streak ? t('home.days') : null}
              />
              <StatTile
                size="lg"
                index={1}
                icon={<CalendarIcon className="h-4 w-4" />}
                label={t('home.thisWeek')}
                value={`${data.weekly}/${weeklyGoal}`}
                footer={
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, (data.weekly / weeklyGoal) * 100)}%`,
                      }}
                    />
                  </div>
                }
              />
            </>
          )}
        </div>
        <WeekDashboard embedded />
      </section>

      <SelectedWorkoutCard sessions={data.sessions} loading={data.loading} />

      <ActivityHeatmap
        cells={heatmap.cells}
        weeks={heatmap.weeks}
        loading={heatmap.loading}
        range={heatmapRange}
        availableRanges={availableRanges.ranges}
        onRangeChange={setHeatmapRange}
      />

      <MedalsTeaserCard />
    </div>
  )
}
