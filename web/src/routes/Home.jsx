import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GreetingHeader from '../components/home/GreetingHeader.jsx'
import StartTrainingCTA from '../components/home/StartTrainingCTA.jsx'
import StatTile from '../components/home/StatTile.jsx'
import QuickAccessList from '../components/home/QuickAccessList.jsx'
import LastSessionsCard from '../components/home/LastSessionsCard.jsx'
import ActivityHeatmap from '../components/home/ActivityHeatmap.jsx'
import {
  CalendarIcon,
  FlameIcon,
  TrophyIcon,
} from '../components/icons/NavIcons.jsx'
import { useUser } from '../contexts/UserContext.jsx'
import { useHomeData } from '../lib/useHomeData.js'
import { resolveExerciseName } from '../lib/exerciseName.js'
import { useAvailableHeatmapRanges, useHeatmap } from '../lib/useHeatmap.js'

/*
  Composición de Home.

  Layout:
  - Desktop (md+): grid de 3 columnas. Fila 1 = saludo (2 col) + CTA (1 col).
    Fila 2 = tres stat tiles. Fila 3 = últimas sesiones (2 col) + columna
    derecha con accesos rápidos y heatmap.
  - Mobile: una sola columna; cambia también el QuickAccessList a `tiles`.

  Los stat tiles usan índice para la animación escalonada, pero fuera de eso
  son cards planas; no hay más de una glow en pantalla (DESIGN.md
  Glow-Is-Earned) — la glow la lleva el CTA.

  Durante el loading se pintan skeletons con la misma geometría del
  resultado final para evitar layout shift. Los valores vacíos se muestran
  como "—" (más honesto que un 0 que parece dato real).
*/

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

export default function Home() {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const data = useHomeData()
  const [heatmapRange, setHeatmapRange] = useState('12w')
  const heatmap = useHeatmap(heatmapRange)
  const availableRanges = useAvailableHeatmapRanges()
  const weeklyGoal = user?.settings?.weeklyGoal ?? DEFAULT_WEEKLY_GOAL

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
      {/* Fila 1 — saludo + CTA. items-start en desktop para que fecha + CTA
          se alineen por arriba (como el mockup), no colgando desde abajo. */}
      <div className="grid gap-5 md:grid-cols-3 md:items-start md:gap-6">
        <div className="md:col-span-2">
          <GreetingHeader />
        </div>
        <div className="md:col-span-1">
          {data.loading ? (
            <Skeleton className="h-24" />
          ) : (
            <StartTrainingCTA
              activeSession={data.activeSession}
              suggestedRoutine={data.suggestedRoutine}
            />
          )}
        </div>
      </div>

      {/* Fila 2 — stat tiles: siempre 3 columnas iguales. items-stretch
          por defecto del grid iguala la altura al tile más alto. */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {data.loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <StatTile
              index={0}
              icon={<FlameIcon className="h-4 w-4" />}
              label={t('home.streak')}
              value={data.streak || '—'}
              suffix={data.streak ? t('home.days') : null}
            />
            {/*
              Tile semanal clicable: lleva al desglose /stats/week con
              series por grupo muscular + edición del objetivo. Lo envolvemos
              por fuera para que StatTile siga siendo un presentador puro;
              el focus-visible global pinta el halo sobre el borde del card.
            */}
            <Link
              to="/stats/week"
              aria-label={t('home.thisWeekLinkAria')}
              className="press rounded-container transition-[filter,transform]"
            >
              <StatTile
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
            </Link>
            <StatTile
              index={2}
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
          </>
        )}
      </div>

      {/* Fila 3 — últimas sesiones + acceso rápido. items-stretch garantiza
          que las dos cards queden a la misma altura, sin huecos. */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          {data.loading ? (
            <Skeleton className="h-64" />
          ) : (
            <LastSessionsCard sessions={data.lastSessions} />
          )}
        </div>
        <div className="md:col-span-1">
          {/* Desktop: lista; mobile: tiles. Dos árboles distintos por
              breakpoint renderiza menos re-arranques que un prop responsive. */}
          <div className="hidden h-full md:block">
            <QuickAccessList variant="list" routinesCount={data.routinesCount} />
          </div>
          <div className="md:hidden">
            <QuickAccessList variant="tiles" routinesCount={data.routinesCount} />
          </div>
        </div>
      </div>

      {/* Fila 4 — heatmap a ancho completo. Fuera de la columna derecha
          para que no compita en vertical con Últimas sesiones y para que el
          año completo (53 semanas) tenga aire para extenderse. */}
      <ActivityHeatmap
        cells={heatmap.cells}
        weeks={heatmap.weeks}
        loading={heatmap.loading}
        range={heatmapRange}
        availableRanges={availableRanges.ranges}
        onRangeChange={setHeatmapRange}
      />
    </div>
  )
}
