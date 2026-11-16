// Home card flagging stalled lifts with a suggested deload; hides itself when none.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useStalledLifts } from '../../lib/useStalledLifts.js'
import { useExerciseProgress } from '../../lib/useExerciseProgress.js'
import { suggestDeload } from '../../lib/suggestProgression.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'
import ExerciseCurve from '../stats/ExerciseCurve.jsx'

export default function StalledCard() {
  const { t } = useTranslation()
  const { loading, stalled } = useStalledLifts()

  if (!loading && stalled.length === 0) return null

  return (
    <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
      <header className="flex items-center gap-2">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.stalled.title')}
        </h2>
      </header>

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-card bg-surface-2" />
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {stalled.map((ex) => (
            <StalledLiftRow key={ex.exerciseId} ex={ex} />
          ))}
        </ul>
      )}
    </section>
  )
}

function StalledLiftRow({ ex }) {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const { loading, error, points } = useExerciseProgress(ex.exerciseId, open)

  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const name = resolveExerciseName(
    {
      _id: ex.exerciseId,
      name:
        ex.name ??
        (ex.exerciseName
          ? { es: ex.exerciseName, en: ex.exerciseName }
          : null),
    },
    user?.exerciseAliases ?? null,
    lang,
  )

  const deloadKg = suggestDeload({ peakKg: ex.peakHeaviestKg })
  const weightFmt = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || 'es', {
        maximumFractionDigits: 1,
      }),
    [i18n.language],
  )

  return (
    <li className="rounded-card bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          open
            ? t('home.stalled.collapseAria', { name })
            : t('home.stalled.expandAria', { name })
        }
        className="press flex w-full items-start gap-2 rounded-card px-3 py-2.5 text-left transition-[filter,transform,color] hover:text-accent"
      >
        <ChevronRightIcon
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-medium text-text">{name}</p>
            <span className="shrink-0 text-[11px] font-medium text-text-muted tabular-nums">
              {t('home.stalled.since', { count: ex.sessionsSince })}
            </span>
          </div>
          {deloadKg != null && (
            <p className="mt-0.5 text-xs text-text-muted">
              {t('home.stalled.plan', { weight: weightFmt.format(deloadKg) })}
            </p>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/60 px-3 py-3">
          {loading && (
            <p className="text-xs text-text-muted">
              {t('weekStats.exerciseCurve.loading')}
            </p>
          )}
          {error && !loading && (
            <p className="text-xs text-error">
              {t('weekStats.exerciseCurve.loadError')}
            </p>
          )}
          {!loading && !error && points && (
            <ExerciseCurve points={points} range="all" />
          )}
        </div>
      )}
    </li>
  )
}
