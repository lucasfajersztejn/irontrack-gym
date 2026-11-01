import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SessionExerciseCard from './SessionExerciseCard.jsx'
import SessionStatsCard from './SessionStatsCard.jsx'
import ExercisePickerSheet from '../routines/ExercisePickerSheet.jsx'
import ConfirmModal from '../routines/ConfirmModal.jsx'
import SupersetBlock from '../routines/SupersetBlock.jsx'
import { useSessionLive } from '../../lib/useSessionLive.js'
import { groupEntries } from '../../lib/supersets.js'

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
    updateSet,
    removeSet,
    addSet,
    addEntry,
    removeEntry,
    setEntries,
  } = useSessionLive(session)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false)

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
          const rows = block.items.map(({ entry, index }) => (
            <SessionExerciseCard
              key={`${typeof entry.exercise === 'string' ? entry.exercise : entry.exercise?._id}-${index}`}
              entry={entry}
              onAddSet={() => addSet(index)}
              onUpdateSet={(setIndex, patch) => updateSet(index, setIndex, patch)}
              onToggleSetComplete={(setIndex, completed) =>
                updateSet(index, setIndex, { completed })
              }
              onRemoveSet={(setIndex) => removeSet(index, setIndex)}
              onRemoveEntry={() => removeEntry(index)}
            />
          ))
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

