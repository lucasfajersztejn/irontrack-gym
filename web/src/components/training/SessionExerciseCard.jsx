import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionSetRow from './SessionSetRow.jsx'
import ExerciseHelpSheet from './ExerciseHelpSheet.jsx'
import BarWeightPopover from './BarWeightPopover.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import { useUser } from '../../contexts/UserContext.jsx'
import { barWeightFor } from '../../lib/weight.js'
import { useExerciseName } from '../../lib/exerciseName.js'
import { estimate1RM } from '../../lib/stats.js'
import { suggestWeightRepsProgression } from '../../lib/suggestProgression.js'

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
  const userBarKg = user?.settings?.defaultBarWeightKg ?? 20
  // Override per-sesión (entry.barWeightKg) tiene prioridad sobre el default
  // del catálogo y la preferencia global del usuario. Ver lib/weight.js.
  const barKg = exerciseObj
    ? barWeightFor(exerciseObj, entry.barWeightKg, userBarKg)
    : 0
  const showBarSettings = exerciseObj?.equipment === 'barbell'

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
              onChange={(patch) => onUpdateSet(i, patch)}
              onToggleComplete={() =>
                onToggleSetComplete(i, !set.completed)
              }
              onDelete={() => onRemoveSet(i)}
            />
          ))}
        </div>
      )}

      {/*
        Sugerencia de progresión: solo aparece para `weight_reps` y mientras
        NINGUNA serie del ejercicio esté completada en esta sesión. Antes
        condicionábamos a `sets.length === 0`, pero bastaba una fila en
        blanco (toque accidental a "+ Añadir", o prefill vacío del picker)
        para que el chip desapareciera sin que el usuario hubiera registrado
        nada todavía. El dato que de verdad marca "ya decidí qué cargar hoy"
        es la primera serie marcada con ✓; hasta entonces la sugerencia
        sigue teniendo sentido.
      */}
      {entry.tracking === 'weight_reps' &&
        !entry.sets.some((s) => s.completed) && (
          <SuggestionChip
            entry={entry}
            history={history}
            onApply={(seed) => onAddSet(seed)}
          />
        )}

      <button
        type="button"
        onClick={() => onAddSet(resolveSeed(entry, history))}
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
  Fuente del prefill al pulsar "+ Añadir serie" CUANDO el entry todavía no
  tiene ninguna serie en esta sesión (si ya hay, useSessionLive.addSet copia
  la última — flujo de "progresión intra-sesión").

  Prioridad:
    1) Última sesión REAL del usuario en este ejercicio (history.lastSession).
       Devolvemos su primer set — las series posteriores se autorreplican.
    2) Plantilla de la rutina (entry.plannedSets, sidecar del POST /sessions).
    3) null → el caller deja los campos vacíos.

  No mezclamos capas (no "si la rutina dice 100 pero la última vez fue 90
  tómalo como 100"): la decisión es FUENTE, no media. "La última vez" gana
  porque es dato real; la plantilla es plan, menos informativo.
*/
/*
  Chip visual con el seed sugerido por suggestWeightRepsProgression. Solo se
  monta cuando hay sugerencia válida: una regla "+2.5 kg · reason" sin peso
  concreto no aporta nada y confunde más que ayuda. Es botón, no decoración:
  tap aplica el seed llamando al mismo onAddSet que el botón "+ Añadir
  serie" — así usar la sugerencia y ignorarla llevan al mismo sitio desde
  el POV del store.
*/
function SuggestionChip({ entry, history, onApply }) {
  const { t } = useTranslation()
  const exerciseObj =
    entry.exercise && typeof entry.exercise === 'object' ? entry.exercise : null
  const seed = suggestWeightRepsProgression({
    lastSession: history?.lastSession ?? null,
    plannedSets: entry.plannedSets ?? null,
    equipment: exerciseObj?.equipment ?? null,
  })
  if (!seed || seed.weightKg == null || seed.reps == null) return null

  const reasonLabel = t(`training.progression.reason.${seed.reason}`, {
    defaultValue: '',
  })
  return (
    <button
      type="button"
      onClick={() =>
        onApply({
          weightKg: seed.weightKg,
          reps: seed.reps,
          addedWeightKg: null,
          durationSec: null,
          distanceM: null,
        })
      }
      className="press group flex items-center justify-between gap-3 self-stretch rounded-control border border-accent/25 bg-accent/5 px-3 py-2 text-left transition-[filter,transform,background-color] hover:bg-accent/10"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-accent/80">
          {t('training.progression.title')}
        </span>
        <span className="tabular font-display text-sm font-semibold text-text">
          {formatKg(seed.weightKg)} kg × {seed.reps}
          {reasonLabel && (
            <span className="ml-1.5 text-xs font-normal text-text-muted">
              · {reasonLabel}
            </span>
          )}
        </span>
      </span>
      <span className="text-xs font-medium text-accent">
        {t('training.progression.apply')}
      </span>
    </button>
  )
}

function resolveSeed(entry, history) {
  const last = history?.lastSession?.sets?.[0]
  if (last) {
    return {
      weightKg: last.weightKg ?? null,
      reps: last.reps ?? null,
      addedWeightKg: last.addedWeightKg ?? null,
      durationSec: last.durationSec ?? null,
      distanceM: last.distanceM ?? null,
    }
  }
  const planned = entry.plannedSets?.[0]
  if (planned) {
    return {
      weightKg: planned.weightKg ?? null,
      reps: planned.reps ?? null,
      addedWeightKg: null,
      durationSec: planned.durationSec ?? null,
      distanceM: planned.distanceM ?? null,
    }
  }
  return null
}
