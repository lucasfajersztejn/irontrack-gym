import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Panel de estadísticas en vivo al final de la sesión.

  Decisiones:
  - Fondo `surface-2` para separarlo visualmente de las cards de ejercicio
    (que son `card-liquid` sobre `surface`). No es glow — DESIGN.md
    Glow-Is-Earned reserva el halo verde al CTA de iniciar entreno; aquí
    jugamos con la elevación tonal.
  - Timer sobrio: pequeño, en la cabecera del panel. Deja de competir con la
    atención del usuario mientras rellena series y queda como información
    de contexto que puede mirar cuando quiera.
  - Tres KPIs grandes (Series completas, Volumen, Grupos trabajados) + un
    desglose por músculo abajo. El desglose solo cuenta series marcadas
    como completadas: refleja el entreno real, no el plan.
  - "Volumen" = suma de weightKg × reps en series completadas de tracking
    weight_reps. Otros tracking (time, distance_time, reps a secas) no
    tienen volumen comparable; se omiten de la cifra total y aparecen solo
    como "series por grupo".

  El componente recibe `entries` del hook useSessionLive y `startedAt` de
  la sesión. Nada de llamadas a red: todo se deriva del estado local.
*/

function useElapsed(startedAtIso) {
  const [, tick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [])
  const started = new Date(startedAtIso).getTime()
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/*
  Reglas de atribución:
  - Músculo primario (entry.muscle): recibe series + volumen + peso máx.
  - Músculos secundarios (entry.exercise.secondaryMuscles, cuando viene
    populado): solo series. Volumen y máx se quedan en el primario para no
    inflar el "máx peso de pecho" al contar un remo.
*/
function ensureBucket(map, muscle) {
  if (!map.has(muscle)) {
    map.set(muscle, { muscle, sets: 0, volume: 0, maxWeight: 0 })
  }
  return map.get(muscle)
}

function aggregate(entries) {
  let completedSets = 0
  let totalVolume = 0
  const byMuscle = new Map()

  for (const e of entries) {
    const completed = e.sets.filter((s) => s.completed)
    if (completed.length === 0) continue
    completedSets += completed.length

    const primary = ensureBucket(byMuscle, e.muscle)
    primary.sets += completed.length
    for (const s of completed) {
      if (e.tracking === 'weight_reps' && s.weightKg != null && s.reps != null) {
        const vol = s.weightKg * s.reps
        totalVolume += vol
        primary.volume += vol
        if (s.weightKg > primary.maxWeight) primary.maxWeight = s.weightKg
      }
    }

    const secondaries =
      (e.exercise && typeof e.exercise === 'object' && e.exercise.secondaryMuscles) || []
    for (const sec of secondaries) {
      if (sec === e.muscle) continue
      const bucket = ensureBucket(byMuscle, sec)
      bucket.sets += completed.length
    }
  }

  const byMuscleArr = Array.from(byMuscle.values())
    .filter((m) => m.sets > 0)
    .sort((a, b) => b.volume - a.volume || b.sets - a.sets)

  return { completedSets, totalVolume, byMuscle: byMuscleArr }
}

export default function SessionStatsCard({ entries, startedAt }) {
  const { t, i18n } = useTranslation()
  const elapsed = useElapsed(startedAt)
  const stats = useMemo(() => aggregate(entries), [entries])

  const fmtVolume = (kg) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }).format(kg)

  return (
    <section
      className="rounded-container bg-surface-2 p-4 md:p-5"
      aria-label={t('training.stats.title')}
    >
      <header className="flex items-end justify-between gap-3">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {t('training.stats.title')}
        </h3>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            {t('training.stats.elapsed')}
          </p>
          <p className="tabular font-display text-sm font-semibold text-text">
            {elapsed}
          </p>
        </div>
      </header>

      {/*
        Tres KPIs en línea. Divisores verticales tenues (border-border/40)
        separan sin añadir ruido; en móvil pasan a horizontales.
      */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Kpi
          label={t('training.stats.setsDone')}
          value={stats.completedSets}
        />
        <Kpi
          label={t('training.stats.volume')}
          value={stats.totalVolume > 0 ? fmtVolume(stats.totalVolume) : '—'}
          suffix={stats.totalVolume > 0 ? 'kg' : null}
        />
        <Kpi
          label={t('training.stats.groups')}
          value={stats.byMuscle.length || '—'}
        />
      </div>

      {stats.byMuscle.length > 0 && (
        <div className="mt-5 flex flex-col gap-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('training.stats.byMuscle')}
          </h4>
          <ul className="flex flex-col gap-1">
            {stats.byMuscle.map((m) => (
              <li
                key={m.muscle}
                className="flex items-baseline justify-between gap-3 rounded-card bg-bg/40 px-3 py-2"
              >
                <span className="truncate text-sm text-text">
                  {t(`catalog.muscles.${m.muscle}`, { defaultValue: m.muscle })}
                </span>
                <span className="tabular flex items-baseline gap-3 text-xs text-text-muted">
                  <span>
                    {t('training.stats.setsCount', { count: m.sets })}
                  </span>
                  {m.volume > 0 && (
                    <span className="text-text">
                      {fmtVolume(m.volume)} kg
                    </span>
                  )}
                  {m.maxWeight > 0 && (
                    <span>
                      {t('training.stats.maxShort', { kg: m.maxWeight })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Kpi({ label, value, suffix }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="tabular font-display text-xl font-semibold leading-none text-text md:text-2xl">
          {value}
        </span>
        {suffix && (
          <span className="text-xs text-text-muted">{suffix}</span>
        )}
      </span>
    </div>
  )
}
