import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../../contexts/UserContext.jsx'
import { useRecords } from '../../lib/useRecords.js'
import { resolveExerciseName } from '../../lib/exerciseName.js'
import { TrophyIcon } from '../icons/NavIcons.jsx'

/*
  "Récords" en Home — PRs all-time persistidos por ejercicio.

  Diferencia vs RecentPrsCard: aquello es ventana de 30d ordenada por
  fecha (motivación a corto plazo). Esto es el estado actual del usuario
  — "en press banca lo máximo que has levantado es X kg" — agrupado por
  músculo para navegar.

  Decisiones:
    - PR principal por tracking: weight_reps => best1RM (comparable
      entre rangos de reps) con heaviestKg como secundario; reps =>
      bestReps. Mostrar los tres por fila sería ruido para el 90% de
      los ejercicios.
    - Group por muscle. El usuario piensa "¿qué récord tengo en pecho?",
      no "¿qué récord tengo en el ejercicio 7". El orden de ejercicios
      dentro de cada grupo respeta `latestAt desc` del server (el más
      reciente arriba).
    - Fecha relativa simple (hoy/ayer/Nd), como RecentPrsCard.
    - Lista larga: la card tiene un viewport interno de ~4 filas con
      scroll propio. Cuando pasa del umbral `EXPAND_THRESHOLD`, un
      botón quita el max-height y despliega todo. Es el patrón de
      "preview + expand": la card no domina el Home por defecto, pero
      el usuario puede verlo todo en una sola vista si quiere.
*/

// Altura del viewport "colapsado": encaja ~4 filas con headings.
// 18rem = 288px. Medido contra una fila (bg-surface-2, 2 líneas) que
// ocupa ~56px con gap-1.5; 4 filas + 1 heading ≈ 260px + aire.
const COLLAPSED_MAX_H = 'max-h-72'

// Encima de este total, el "colapsado" ya esconde demasiado y toca
// ofrecer expandir. Por debajo, la lista cabe de sobra y el botón
// sería ruido.
const EXPAND_THRESHOLD = 6

function formatKg(v) {
  if (v == null) return '—'
  return `${Number(v).toFixed(1)} kg`
}

function relativeDays(dateStr, now = new Date()) {
  if (!dateStr) return ''
  const diffMs = now - new Date(dateStr)
  const day = 86_400_000
  const days = Math.floor(diffMs / day)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `${days}d`
}

function groupByMuscle(records) {
  const map = new Map()
  for (const rec of records) {
    const key = rec.muscle ?? 'other'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(rec)
  }
  // Orden de grupos: el que tenga el PR más reciente aparece primero,
  // así el usuario ve lo que acaba de caer sin scrollear.
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
          // overflow-y-auto + max-h da el viewport interno. pr-1 deja
          // hueco para el scrollbar sin que tape texto. overscroll-contain
          // evita que al llegar al tope el scroll se propague y arrastre
          // el Home entero — en mobile eso se nota mucho.
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
                              name: rec.exerciseName
                                ? { [lang]: rec.exerciseName, es: rec.exerciseName, en: rec.exerciseName }
                                : null,
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
                          {relativeDays(primary?.achievedAt ?? rec.latestAt)}
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
