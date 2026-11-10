import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionSetRow from './SessionSetRow.jsx'
import ExerciseHelpSheet from './ExerciseHelpSheet.jsx'
import BarWeightPopover from './BarWeightPopover.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import { useUser } from '../../contexts/UserContext.jsx'
import { barWeightFor, perSideFromTotal } from '../../lib/weight.js'
import { useExerciseName } from '../../lib/exerciseName.js'
import { estimate1RM } from '../../lib/stats.js'
import {
  suggestFirstSetOfDay,
  suggestNextSetInSession,
} from '../../lib/suggestProgression.js'

// Tolerancia para la comparación de 1RM contra el récord histórico. El
// backend guarda el PR redondeado a 1 decimal (ver exerciseController.js
// getExercisesHistory); sin margen, una serie que vuelva a clavar el mismo
// 1RM post-redondeo dispararía el chip "PR" por un residuo de coma flotante.
const PR_TOLERANCE_KG = 0.1

/*
  Card de un ejercicio dentro de la sesión live. Header con nombre + chips
  (músculo + progreso) + botón ayuda (?) + botón borrar. Lista de
  SessionSetRow + "+ Añadir serie".

  Datos del ejercicio: /api/sessions/active hace populate, así que
  entry.exercise es el documento completo del catálogo (gifUrl,
  instructions, equipment, usesBar). Cuando el usuario añade un ejercicio
  mid-session, también llega completo del picker. Si falla populate
  (ejercicio borrado del catálogo), entry.exercise puede ser null u
  ObjectId — defensivo abajo.

  Peso de barra: barWeightFor() lee de exercise.defaultBarWeightKg
  (Z=7, Smith=15, barbell=user default) con fallback a 20 kg. Durante la
  sesión no hay override per-entry (el modelo de session no lo guarda);
  si en el futuro se añade, aquí es donde se consultaría primero.
*/
export default function SessionExerciseCard({
  entry,
  history,
  onAddSet,
  onUpdateSet,
  onUpdateEntry,
  onToggleSetComplete,
  onRemoveSet,
  onRemoveEntry,
}) {
  const { t } = useTranslation()
  const { user } = useUser()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const completedCount = entry.sets.filter((s) => s.completed).length

  /*
    Agregado vivo del ejercicio: tonelaje acumulado y 1RM estimado del día.
    Solo tiene sentido para `weight_reps` (fuerza con peso externo); el
    resto de trackings no aportan a estas métricas, y mostrar 0 kg llenaría
    el card de ruido. Por eso abajo solo se renderiza si ambos > 0.
  */
  const liveStats = useMemo(() => {
    if (entry.tracking !== 'weight_reps') return null
    let tonnage = 0
    let best = 0
    for (const s of entry.sets) {
      if (!s.completed) continue
      if (s.weightKg == null || s.reps == null) continue
      tonnage += s.weightKg * s.reps
      const oneRm = estimate1RM(s.weightKg, s.reps)
      if (oneRm > best) best = oneRm
    }
    return { tonnage, best1RM: best }
  }, [entry.sets, entry.tracking])

  // El récord histórico llega del endpoint /api/exercises/history. Si el
  // ejercicio nunca se ha trabajado antes, el baseline es 0 y el primer 1RM
  // válido ya cuenta como PR — que es exactamente lo que queremos.
  const historical1RM = history?.prs?.best1RM ?? 0
  const isPR =
    liveStats != null &&
    liveStats.best1RM > 0 &&
    liveStats.best1RM > historical1RM + PR_TOLERANCE_KG

  const exerciseObj =
    entry.exercise && typeof entry.exercise === 'object' ? entry.exercise : null
  // Preferimos pintar el nombre a partir del catálogo populado (para captar
  // el alias actual del usuario); si no viene populado, caemos al snapshot
  // denormalizado de la sesión. El snapshot sigue siendo quien persiste en DB.
  const { name: displayName } = useExerciseName(exerciseObj ?? entry)
  const usesBar = Boolean(exerciseObj?.usesBar)
  const barInputMode = user?.settings?.barInputMode ?? 'plates'
  // Preferencia del usuario (Ajustes → Tu entreno). `!== false` y no `?? true`
  // para que el chip aparezca también si `settings` aún no ha llegado: el
  // default del modelo es true, y ocultar algo que va a aparecer un tick
  // después se lee como un parpadeo.
  const suggestProgression = user?.settings?.suggestProgression !== false
  const userBarKg = user?.settings?.defaultBarWeightKg ?? 20
  // Override per-sesión (entry.barWeightKg) tiene prioridad sobre el default
  // del catálogo y la preferencia global del usuario. Ver lib/weight.js.
  const barKg = exerciseObj
    ? barWeightFor(exerciseObj, entry.barWeightKg, userBarKg)
    : 0
  const showBarSettings = exerciseObj?.equipment === 'barbell'

  /*
    La DB guarda kilos totales (spec §1) pero la progresión razona en la
    unidad que el usuario teclea: por lado cuando la barra está en modo
    discos, el peso tal cual en el resto. Sin esta conversión un salto de
    2.5 "por lado" se convertía en 1.25 real, que no se puede montar.
  */
  const showPlatesInput =
    entry.tracking === 'weight_reps' && usesBar && barInputMode === 'plates'
  const toDisplayKg = (totalKg) =>
    totalKg == null
      ? null
      : showPlatesInput
        ? perSideFromTotal(totalKg, barKg)
        : totalKg

  return (
    <article className="card-liquid flex flex-col gap-3 rounded-container p-3 md:p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-tight text-text">
            {displayName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-pill bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              {t(`catalog.muscles.${entry.muscle}`, { defaultValue: entry.muscle })}
            </span>
            <span className="tabular text-[11px] text-text-muted">
              {t('training.setsProgress', {
                done: completedCount,
                total: entry.sets.length,
              })}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showBarSettings && (
            <BarWeightPopover
              value={entry.barWeightKg ?? null}
              currentKg={barKg}
              onChange={(nextKg) => onUpdateEntry?.({ barWeightKg: nextKg })}
            />
          )}
          {exerciseObj && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t('training.helpOpen', { name: displayName })}
              className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2M12 17h.01" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={t('training.removeExercise')}
            className="press rounded-full p-1.5 text-text-muted transition-[filter,transform,color] hover:text-error"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {liveStats && liveStats.best1RM > 0 && (
        <LiveStatsRow
          tonnage={liveStats.tonnage}
          best1RM={liveStats.best1RM}
          isPR={isPR}
        />
      )}

      {entry.sets.length > 0 && (
        <div className="flex flex-col gap-1">
          {/*
            Cabecera columnar: minúscula, label-casing, por encima de las
            filas. Dos columnas de valor según tracking; etiqueta "✓" sobre
            el checkbox y espacio sobre el borrar.
          */}
          <SetListHeader tracking={entry.tracking} />
          {entry.sets.map((set, i) => (
            <SessionSetRow
              key={i}
              index={i}
              set={set}
              tracking={entry.tracking}
              usesBar={usesBar}
              barInputMode={barInputMode}
              barKg={barKg}
              suggestion={suggestionForSet(
                entry,
                history,
                i,
                suggestProgression,
                toDisplayKg,
              )}
              onChange={(patch) => onUpdateSet(i, patch)}
              onToggleComplete={() =>
                onToggleSetComplete(i, !set.completed)
              }
              onDelete={() => onRemoveSet(i)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onAddSet()}
        className="press self-start rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-[filter,transform,background-color] hover:bg-surface-2"
      >
        + {t('training.addSet')}
      </button>

      <ConfirmModal
        open={confirmOpen}
        title={t('training.confirmRemoveExerciseTitle', {
          name: displayName,
        })}
        description={t('training.confirmRemoveExerciseSub')}
        confirmLabel={t('training.removeExercise')}
        onConfirm={() => {
          setConfirmOpen(false)
          onRemoveEntry()
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ExerciseHelpSheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        exercise={exerciseObj}
      />
    </article>
  )
}

/*
  Línea viva de agregados del ejercicio: tonelaje acumulado hoy + 1RM
  estimado de la mejor serie hoy, con chip "PR" si bate el récord histórico.

  Dos columnas en vez de una fila de pills porque el ojo debe comparar
  el 1RM contra lo que recuerda del día anterior — mejor dos cifras
  grandes con su label que una ristra de chips. `tabular-nums` para que
  las cifras no "bailen" al ir cambiando entre series. El acento verde
  se reserva al 1RM cuando es PR; el tonelaje nunca lo usa para que el
  verde siga significando "récord", no "métrica positiva".
*/
function LiveStatsRow({ tonnage, best1RM, isPR }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-stretch gap-2 rounded-card bg-surface-2/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
          {t('training.liveStats.tonnage')}
        </p>
        <p className="tabular font-display text-sm font-semibold text-text">
          {Math.round(tonnage)} kg
        </p>
      </div>
      <div className="h-auto w-px bg-border/60" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('training.liveStats.oneRm')}
          </p>
          {isPR && (
            <span
              className="rounded-pill bg-accent/15 px-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-accent"
              aria-label={t('training.liveStats.prAria')}
            >
              {t('training.liveStats.pr')}
            </span>
          )}
        </div>
        <p
          className={`tabular font-display text-sm font-semibold ${
            isPR ? 'text-accent' : 'text-text'
          }`}
        >
          {formatKg(best1RM)} kg
        </p>
      </div>
    </div>
  )
}

function formatKg(kg) {
  // Una decimal, sin ceros colgando: 100.0 → 100, 102.5 → 102.5.
  return Number.isInteger(kg) ? String(kg) : (Math.round(kg * 10) / 10).toString()
}

/*
  Cabecera de columnas por tracking. El tamaño del grid replica el de
  SessionSetRow (flex con inputs 1fr) para que las etiquetas caigan sobre
  sus columnas. Uso `text-[10px] uppercase tracking-[0.08em]` consistente
  con los labels del editor de rutinas.
*/
function SetListHeader({ tracking }) {
  const { t } = useTranslation()
  const labels = (() => {
    switch (tracking) {
      case 'weight_reps':
        return [t('training.setFields.weight'), t('training.setFields.reps')]
      case 'reps':
        return [t('training.setFields.reps')]
      case 'time':
        return [t('training.setFields.duration')]
      case 'distance_time':
        return [t('training.setFields.distance'), t('training.setFields.duration')]
      default:
        return []
    }
  })()
  return (
    <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
      <span className="w-6 shrink-0 text-center">#</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 text-center">
            {l}
          </span>
        ))}
      </div>
      <span className="w-9 shrink-0 text-center">✓</span>
      <span className="w-7 shrink-0" />
    </div>
  )
}

/*
  Sugerencia que se pinta como PLACEHOLDER en los inputs de una serie.

  Prioridad:
    1) Serie i > 0 → la anterior de HOY, por la escala de RIR. Se recalcula
       en cada render, así que anotar el RIR de la serie 1 actualiza al
       instante el placeholder de la serie 2.
    2) Serie 0 (o serie anterior aún en blanco) → primera serie de la última
       vez + un escalón, con la plantilla de la rutina como respaldo.
    3) null → el input se queda con su placeholder genérico ("kg", "Reps").

  `toDisplay` convierte los kilos TOTALES que guarda la DB a la unidad en la
  que escribe el usuario (por lado si la barra está en modo discos). Las
  reglas trabajan en esa unidad y devuelven en esa unidad, así que lo que
  sale se pinta tal cual.

  Es SUGERENCIA, no dato: viaja como `placeholder`, nunca como `value`. La
  serie nace vacía y solo se persiste cuando el usuario escribe (toApiEntries
  filtra las incompletas), así que nada se guarda por proponerlo.

  Devuelve null si el usuario apagó la progresión en Ajustes, o si el
  tracking no es `weight_reps`: las reglas son de fuerza con peso externo, y
  cardio e isométricos progresan por tiempo/distancia, que no está modelado.
*/
function suggestionForSet(entry, history, index, suggestProgression, toDisplay) {
  if (!suggestProgression || entry.tracking !== 'weight_reps') return null

  if (index > 0) {
    const prev = entry.sets[index - 1]
    const next = suggestNextSetInSession({
      lastSet: {
        weightKg: toDisplay(prev?.weightKg),
        reps: prev?.reps ?? null,
        rir: prev?.rir ?? null,
      },
    })
    // Si la serie anterior sigue en blanco no hay de dónde encadenar: caemos
    // a la sugerencia de entrada para no dejar la fila muda.
    if (next) return next
  }

  const firstLastTime = history?.lastSession?.sets?.[0] ?? null
  const planned = entry.plannedSets?.[0] ?? null
  return suggestFirstSetOfDay({
    firstSetLastTime: firstLastTime
      ? { weightKg: toDisplay(firstLastTime.weightKg), reps: firstLastTime.reps ?? null }
      : null,
    plannedSet: planned
      ? { weightKg: toDisplay(planned.weightKg), reps: planned.reps ?? null }
      : null,
  })
}
