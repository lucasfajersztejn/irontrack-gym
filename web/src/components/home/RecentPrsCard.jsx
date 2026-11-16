// Home card listing the user's most recent personal records.

import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useRecentPrs } from '../../lib/useRecentPrs.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { TrophyIcon } from '../icons/NavIcons.jsx'

const PR_LABEL_KEYS = {
  heaviest: 'home.prHeaviest',
  '1rm': 'home.prOneRm',
  reps: 'home.prReps',
}

const MAX_ROWS_MOBILE = 3
const MAX_ROWS_DESKTOP = 5

function formatValue(kind, value) {
  if (value == null) return '—'
  if (kind === 'reps') return `${value}`
  return `${Number(value).toFixed(1)} kg`
}

function relativeDays(dateStr, t, now = new Date()) {
  const date = new Date(dateStr)
  const diffMs = now - date
  const day = 86_400_000
  const days = Math.floor(diffMs / day)
  if (days <= 0) return t('home.relToday')
  if (days === 1) return t('home.relYesterday')
  return `${days}d`
}

export default function RecentPrsCard() {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const { loading, prs } = useRecentPrs(30)

  const visible = prs.slice(0, MAX_ROWS_DESKTOP)

  return (
    <section className="card-liquid flex h-full flex-col gap-2 rounded-container p-3 md:p-5">
      <header className="flex items-center gap-2">
        <TrophyIcon className="h-4 w-4 text-accent" />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.recentPrs')}
        </h2>
      </header>

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={i}
              className="h-9 animate-pulse rounded-card bg-surface-2"
            />
          ))}
        </ul>
      ) : prs.length === 0 ? (
        <p className="text-sm text-text-muted">{t('home.recentPrsEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((pr, idx) => (
            <li
              key={`${pr.exerciseId}-${pr.kind}-${idx}`}
              className={`flex flex-col gap-0.5 rounded-card bg-surface-2 px-2.5 py-1.5 md:px-3 md:py-2 ${
                idx >= MAX_ROWS_MOBILE ? 'hidden md:flex' : ''
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  {resolveExerciseName(
                    {
                      _id: pr.exerciseId,
                      name:
                        pr.name ??
                        (pr.exerciseName
                          ? { es: pr.exerciseName, en: pr.exerciseName }
                          : null),
                    },
                    user?.exerciseAliases ?? null,
                    lang,
                  )}
                </span>
                <span className="shrink-0 font-display text-sm font-semibold text-accent tabular-nums">
                  {formatValue(pr.kind, pr.value)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted md:text-[11px]">
                <span className="truncate font-medium uppercase tracking-wide">
                  {t(PR_LABEL_KEYS[pr.kind] ?? 'home.prHeaviest')}
                </span>
                <span className="shrink-0 tabular-nums">
                  {relativeDays(pr.achievedAt, t)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
