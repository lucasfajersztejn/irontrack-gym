import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionExerciseCard from './SessionExerciseCard.jsx'
import SessionStatsCard from './SessionStatsCard.jsx'
import RestTimerBar from './RestTimerBar.jsx'
import ExercisePickerSheet from '../routines/ExercisePickerSheet.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import SupersetBlock from '../routines/SupersetBlock.jsx'
import { PRToastStack } from '../ui/PRToast.jsx'
import { useSessionLive } from '../../lib/useSessionLive.js'
import { useExerciseHistory } from '../../lib/useExerciseHistory.js'
import { groupEntries } from '../../lib/supersets.js'
import { REST_DEFAULT_SEC, useSessionStore } from '../../stores/sessionStore.js'
import { useUser } from '../../contexts/UserContext.jsx'

/*
  Vista "live" de la sesión activa. Compone el header (nombre + cronómetro
  vivo + status de guardado) con la lista de SessionExerciseCard y las dos
  acciones del flujo: añadir ejercicio (sheet reusada del editor de rutinas)
  y terminar sesión (confirm modal → POST /finish desde el parent).

  La vista NO conoce la red directamente: useSessionLive hace el debounced
  PATCH, y el prop `onFinish` dispara el cierre arriba (Training.jsx) para
  que la navegación vuelva al picker con un solo setSession(null).
*/
export default function SessionLiveView({ session, onFinish, finishing }) {
  const { t } = useTranslation()
  const {
    entries,
    status,
    updateEntry,
    updateSet,
    removeSet,
    addSet,
    addEntry,
    removeEntry,
    setEntries,
  } = useSessionLive(session)
  const { history, detectPR } = useExerciseHistory(session)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const toastIdRef = useRef(0)
  const stopRest = useSessionStore((s) => s.stopRest)

  const pushToast = (toast) => {
    toastIdRef.current += 1
    setToasts((xs) => [...xs, { id: toastIdRef.current, ...toast }])
  }
  const dismissToast = (id) =>
    setToasts((xs) => xs.filter((t) => t.id !== id))

  /*
    PR detection: wrapper del toggle de completar. Si pasa de "no completado"
    a "completado" y la serie supera el baseline histórico, mostramos toast.
    El baseline vive en el ref de useExerciseHistory, así que llamadas
    sucesivas a detectPR con la misma marca devuelven null (no re-notifican).
  */
  const toggleSetCompleteWithPR = (entryIndex, setIndex, completed) => {
    const entry = entries[entryIndex]
    const set = entry?.sets?.[setIndex]
    updateSet(entryIndex, setIndex, { completed })
    if (!entry || !set || !completed || set.completed) return
    const exerciseId =
      typeof entry.exercise === 'string' ? entry.exercise : entry.exercise?._id
    const hit = detectPR(exerciseId, entry.tracking, set)
    if (hit) {
      pushToast({
        exerciseName: entry.exerciseName,
        kind: hit.kind,
        value: hit.value,
      })
    }
  }

  /*
    Descanso por defecto del usuario. REST_DEFAULT_SEC solo cubre el hueco
    entre el primer render y la respuesta de `/api/me`; es el mismo número
    que el default del campo en el modelo, así que la barra no cambia de
    duración al cargar el usuario.
  */
  const { user } = useUser()
  const restSec = user?.settings?.restTimerSec ?? REST_DEFAULT_SEC

  // Al salir de la vista (terminar sesión, navegar fuera) no queremos que el
  // store se quede con un descanso a medias que reaparezca en la próxima.
  // Esto cubre también el caso de ir a Ajustes y poner el descanso en Off:
  // al volver no hay cuenta atrás heredada esperando.
  useEffect(() => stopRest, [stopRest])

  const alreadyIds = entries.map((e) =>
    typeof e.exercise === 'string' ? e.exercise : e.exercise?._id,
  )

  // Durante el entreno el usuario NO reagrupa supersets a mano (fricción
  // alta en gym); solo puede DESHACER un bloque si prefiere ejecutarlos
  // por separado. Separar borra el groupId de todos los miembros del
  // bloque — se escribe en el PATCH debounced igual que cualquier otro
  // cambio de entries.
  const ungroupBlock = (firstIndex) => {
    setEntries((es) => {
      const gid = es[firstIndex]?.groupId
      if (!gid) return es
      return es.map((e) => (e.groupId === gid ? { ...e, groupId: null } : e))
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <SessionHeader session={session} status={status} />

      <div className="flex flex-col gap-3">
        {entries.length === 0 && (
          <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-8 text-center">
            <p className="font-display text-sm font-semibold text-text">
              {t('training.liveEmptyTitle')}
            </p>
            <p className="text-xs text-text-muted">
              {t('training.liveEmptySub')}
            </p>
          </div>
        )}
        {/*
          Igual que el editor de rutinas: agrupamos entries contiguos del
          mismo groupId en SupersetBlock. Durante el entreno el usuario puede
          separar un bloque (para hacer los ejercicios con descanso) pero no
          crear nuevos — crear bloques es flujo de planificación, no de
          ejecución, y añadir un botón "agrupar" en vivo invita a errores
          mientras suda.
        */}
        {groupEntries(entries).map((block, bi) => {
          const isSuperset = block.items.length > 1
          const rows = block.items.map(({ entry, index }) => {
            const exerciseId =
              typeof entry.exercise === 'string'
                ? entry.exercise
                : entry.exercise?._id
            const entryHistory = history[exerciseId] ?? null
            return (
              <SessionExerciseCard
                key={`${exerciseId}-${index}`}
                entry={entry}
                history={entryHistory}
                onAddSet={(seed) => addSet(index, seed)}
                onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
                onUpdateEntry={(patch) => updateEntry(index, patch)}
                onToggleSetComplete={(setIndex, completed) =>
                  toggleSetCompleteWithPR(index, setIndex, completed)
                }
                onRemoveSet={(setIndex) => removeSet(index, setIndex)}
                onRemoveEntry={() => removeEntry(index)}
              />
            )
          })
          if (isSuperset) {
            return (
              <SupersetBlock
                key={block.groupId}
                onUngroup={() => ungroupBlock(block.items[0].index)}
              >
                {rows}
              </SupersetBlock>
            )
          }
          return (
            <div key={`solo-${bi}`} className="flex flex-col gap-2">
              {rows}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="press self-stretch rounded-container border border-dashed border-border bg-surface/40 px-4 py-3 text-sm font-medium text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface hover:text-text"
      >
        + {t('training.addExercise')}
      </button>

      <button
        type="button"
        onClick={() => setConfirmFinishOpen(true)}
        disabled={finishing}
        className="press rounded-control bg-accent px-5 py-3 text-sm font-semibold text-bg transition-[filter,transform] hover:brightness-[1.08] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {finishing ? t('training.finishing') : t('training.finish')}
      </button>

      <SessionStatsCard entries={entries} startedAt={session.startedAt} />

      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exercise) => {
          addEntry(exercise)
          setPickerOpen(false)
        }}
        alreadyPickedIds={alreadyIds}
      />

      <ConfirmModal
        open={confirmFinishOpen}
        title={t('training.confirmFinishTitle')}
        description={t('training.confirmFinishSub')}
        confirmLabel={t('training.finish')}
        onConfirm={() => {
          setConfirmFinishOpen(false)
          onFinish()
        }}
        onCancel={() => setConfirmFinishOpen(false)}
        destructive={false}
      />

      {/*
        Barra de descanso. No se monta si el usuario puso el descanso en Off
        (`restTimerSec: 0`) desde Ajustes: ahí la decisión es "no quiero
        cronómetro", y una barra fija ocupando el borde inferior de la
        pantalla no es algo que se pueda ignorar.

        El hueco de abajo va con ella: la barra es `fixed`, así que no ocupa
        sitio en el flujo, y sin este div el panel de stats queda tapado al
        final del scroll. Vive aquí y no en el padding de AppShell porque la
        barra solo existe durante una sesión activa.
      */}
      {restSec > 0 && (
        <>
          <div aria-hidden className="h-16 md:h-20" />
          <RestTimerBar restSec={restSec} />
        </>
      )}

      <PRToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

/*
  Header compacto: nombre de la rutina (o "libre") + indicador tenue del
  estado de guardado. El tiempo transcurrido vive abajo en SessionStatsCard
  (decisión de UX: durante el entreno el reloj no aporta cada vez que miras
  — como información de contexto en el panel de stats sí).
*/
function SessionHeader({ session, status }) {
  const { t } = useTranslation()
  const subtitle = session.routineName ?? t('training.resumeSubFree')

  return (
    <header className="card-liquid flex items-center justify-between gap-3 rounded-container p-4">
      <div className="min-w-0">
        <h2 className="truncate font-display text-base font-semibold tracking-tight text-text">
          {subtitle}
        </h2>
        <StatusDot status={status} />
      </div>
    </header>
  )
}

function StatusDot({ status }) {
  const { t } = useTranslation()
  if (status === 'idle') return null
  const map = {
    saving: { label: t('training.saving'), color: 'bg-text-muted' },
    saved: { label: t('training.saved'), color: 'bg-accent' },
    error: { label: t('training.saveError'), color: 'bg-error' },
  }
  const { label, color } = map[status] ?? map.saving
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
      <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

