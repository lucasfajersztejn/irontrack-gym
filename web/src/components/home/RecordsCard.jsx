// Home card with personal records grouped by muscle, collapsible when long.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useRecords } from '../../lib/useRecords.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { TrophyIcon } from '../icons/NavIcons.jsx'

const COLLAPSED_MAX_H = 'max-h-72'

const EXPAND_THRESHOLD = 6

function formatKg(v) {
  if (v == null) return '—'
  return `${Number(v).toFixed(1)} kg`
}

function relativeDays(dateStr, t, now = new Date()) {
  if (!dateStr) return ''
  const diffMs = now - new Date(dateStr)
  const day = 86_400_000
  const days = Math.floor(diffMs / day)
  if (days <= 0) return t('home.relToday')
  if (days === 1) return t('home.relYesterday')
  return `${days}d`
}

function groupByMuscle(records) {
  const map = new Map()
  for (const rec of records) {
    const key = rec.muscle ?? 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(rec)
  }
  return Array.from(map.entries()).sort(([, a], [, b]) => {
    const da = a[0]?.latestAt ? new Date(a[0].latestAt).getTime() : 0
    const db = b[0]?.latestAt ? new Date(b[0].latestAt).getTime() : 0
    return db - da
  })
}

export default function RecordsCard() {
  const { t, i18n } = useTranslation()
  const { user } = useUser()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es'
  const { loading, records } = useRecords()

  const groups = useMemo(() => groupByMuscle(records), [records])
  const [expanded, setExpanded] = useState(false)
  const canExpand = records.length > EXPAND_THRESHOLD

  return (
    <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
      <header className="flex items-center gap-2">
        <TrophyIcon className="h-4 w-4 text-accent" />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('home.records')}
        </h2>
      </header>

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-12 animate-pulse rounded-card bg-surface-2"
            />
          ))}
        </ul>
      ) : records.length === 0 ? (
        <p className="text-sm text-text-muted">{t('home.recordsEmpty')}</p>
      ) : (
        <div
          className={`flex flex-col gap-4 ${
            expanded ? '' : `${COLLAPSED_MAX_H} scrollbar-thin overflow-y-auto overscroll-contain pr-1`
          }`}
        >
          {groups.map(([muscle, rows]) => (
            <div key={muscle} className="flex flex-col gap-1.5">
              <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted">
                {t(`catalog.muscles.${muscle}`, { defaultValue: muscle })}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {rows.map((rec) => {
                  const primary =
                    rec.tracking === 'reps' ? rec.bestReps : rec.best1RM
                  const secondary =
                    rec.tracking === 'weight_reps' ? rec.heaviestKg : null
                  const primaryLabel =
                    rec.tracking === 'reps'
                      ? t('home.prReps')
                      : t('home.prOneRm')
                  const primaryValue =
                    rec.tracking === 'reps'
                      ? primary?.value ?? '—'
                      : formatKg(primary?.value)

                  return (
                    <li
                      key={rec.exerciseId}
                      className="flex flex-col gap-0.5 rounded-card bg-surface-2 px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-text">
                          {resolveExerciseName(
                            {
                              _id: rec.exerciseId,
                              name:
                                rec.name ??
                                (rec.exerciseName
                                  ? { es: rec.exerciseName, en: rec.exerciseName }
                                  : null),
                            },
                            user?.exerciseAliases ?? null,
                            lang,
                          )}
                        </span>
                        <span className="shrink-0 font-display text-sm font-semibold text-accent tabular-nums">
                          {primaryValue}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-text-muted md:text-[11px]">
                        <span className="truncate font-medium uppercase tracking-wide">
                          {primaryLabel}
                          {secondary ? (
                            <span className="ml-2 normal-case tracking-normal text-text-muted/80">
                              · {t('home.prHeaviest')} {formatKg(secondary.value)}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {relativeDays(primary?.achievedAt ?? rec.latestAt, t)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {canExpand && !loading && records.length > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted transition hover:text-text focus-visible:text-text"
        >
          {expanded
            ? t('home.recordsCollapse')
            : t('home.recordsExpand', { count: records.length })}
        </button>
      ) : null}
    </section>
  )
}
