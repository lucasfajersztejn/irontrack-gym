import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GreetingHeader from '../components/home/GreetingHeader.jsx'
import NextWorkoutCard from '../components/home/NextWorkoutCard.jsx'
import RecentPrsCard from '../components/home/RecentPrsCard.jsx'
import SelectedWorkoutCard from '../components/home/SelectedWorkoutCard.jsx'
import StatTile from '../components/home/StatTile.jsx'
import ActivityHeatmap from '../components/home/ActivityHeatmap.jsx'
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

/*
  Home 3.1 — dashboard agrupado por bloques semánticos.

  La versión 3.0 mezclaba "racha", "esta semana" y "1RM reciente" en una
  misma fila de tiles aunque cada uno responde a una pregunta distinta:
    - racha / esta semana → cuánto HE ENTRENADO (actividad).
    - 1RM reciente → QUÉ TAN FUERTE estoy (rendimiento).

  Al pegarlos todos juntos el usuario leía "números" en vez de leer la
  historia. Esta versión agrupa:
    1. Greeting + NextWorkoutCard — qué toca hoy.
    2. Bloque Rendimiento — 1RM reciente + PRs recientes.
    3. Bloque Actividad — Racha + Esta semana + WeekDashboard embebido.
    4. SelectedWorkoutCard — elegir un entreno y ver curvas por ejercicio.
    5. Heatmap — foto grande del año.

  Las dos tiles del bloque Actividad usan StatTile size="lg" para no
  verse enanas junto al WeekDashboard que crece abajo (antes h-32 se
  quedaba corto en mobile).
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

/*
  Cabecera de sección con subrayado corto en accent. Antes era un <h2>
  pelado (muy tímido) y las secciones se mezclaban visualmente. El
  divisor horizontal a ancho completo sobrecargaba; una barra fina
  acotada a ~40 px da peso al label sin pelear con las cards de abajo.
*/
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
      {/* Fila 1 — saludo + Next Workout. grid-cols-1 EXPLÍCITO en mobile:
          sin él, `grid` deja que las columnas crezcan al ancho intrínseco
          del contenido y una card con texto largo se sale del viewport
          (overflow-x-hidden la clipa, pero sigue cortada visualmente). */}
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

      {/* Bloque 2 — Rendimiento: 1RM reciente + PRs recientes.
          En desktop la tile de 1RM ocupa 1 col y PRs 2 cols; en mobile
          stacked. Comparten altura visual gracias a items-stretch
          implícito del grid. */}
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

      {/* Bloque 3 — Actividad: tiles grandes + dashboard semanal embebido.
          Las tiles usan size="lg" para equiparar peso visual al bloque
          de sesiones que viene justo debajo. */}
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

      {/* Bloque 4 — Detalle de entreno. Select de sesión + rango de
          curvas; cada ejercicio con su gráfico expandido. */}
      <SelectedWorkoutCard sessions={data.sessions} loading={data.loading} />

      {/* Bloque 5 — heatmap. Año completo necesita ancho. */}
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
