import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ExerciseEditorRow from '../components/routines/ExerciseEditorRow.jsx'
import ExercisePickerSheet from '../components/routines/ExercisePickerSheet.jsx'
import ConfirmModal from '../components/routines/ConfirmModal.jsx'
import MuscleChips from '../components/MuscleChips.jsx'
import SupersetBlock from '../components/routines/SupersetBlock.jsx'
import { useRoutine } from '../lib/useRoutine.js'
import { api } from '../lib/api.js'
import { groupEntries, mergeWithNext, unmergeAt } from '../lib/supersets.js'

/*
  Deriva los grupos trabajados por una rutina a partir del array populado de
  ejercicios: primarios únicos + secundarios únicos (quitando los que ya son
  primarios para no duplicar el chip bajo las dos variantes). Vive aquí
  (y no en MuscleChips) para no acoplar la pieza visual a esta estructura
  concreta — en /stats/week el equivalente lo calcula breakdownForSession.
*/
function routineMuscles(entries) {
  const primary = new Set()
  const secondary = new Set()
  for (const e of entries) {
    const ex = e.exercise
    if (!ex || typeof ex !== 'object') continue
    if (ex.muscle) primary.add(ex.muscle)
    for (const sec of ex.secondaryMuscles ?? []) secondary.add(sec)
  }
  for (const p of primary) secondary.delete(p)
  return { primary: Array.from(primary), secondary: Array.from(secondary) }
}

/*
  Editor único para crear y editar rutinas. La ruta /routines/new monta sin
  id y el editor arranca vacío; /routines/:id monta con id y el editor espera
  al detalle poblado del backend para prellenar.

  Estado local único: { name, description, entries[] } donde cada entry es
  { exercise: fullObject, targetSets, targetReps, targetWeightKg,
    targetDurationSec, targetDistanceM, notes }.

  Al guardar, se mapea a la forma del backend ({ exercise: id, order, ... }).
  El backend reemplaza el array entero (decisión documentada en el
  controller), así que no distinguimos entre "añadir ejercicio nuevo" y
  "editar un ejercicio existente": todo es un sync del array completo.
*/

/*
  Defaults al añadir un ejercicio al editor. Series es el único campo que
  prellenamos — reps y peso quedan vacíos para que el usuario los ponga a
  conciencia (reps objetivo es opcional; peso de arranque depende del
  usuario). Para cardio sí tiene sentido un punto de partida razonable.
*/
const TRACKING_DEFAULTS = {
  weight_reps: { targetSets: 3 },
  reps: { targetSets: 3 },
  time: { targetSets: 3, targetDurationSec: 30 },
  distance_time: { targetDurationSec: 600, targetDistanceM: 1000 },
}

function normalize(routine) {
  if (!routine) return { name: '', description: '', entries: [] }
  return {
    name: routine.name ?? '',
    description: routine.description ?? '',
    entries: (routine.exercises ?? []).map((e) => ({
      exercise: e.exercise, // ya viene populado del backend
      targetSets: e.targetSets ?? null,
      targetReps: e.targetReps ?? null,
      targetWeightKg: e.targetWeightKg ?? null,
      targetDurationSec: e.targetDurationSec ?? null,
      targetDistanceM: e.targetDistanceM ?? null,
      barWeightKg: e.barWeightKg ?? null,
      groupId: e.groupId ?? null,
      notes: e.notes ?? '',
    })),
  }
}

function toApiPayload(state) {
  return {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    exercises: state.entries.map((e, index) => ({
      exercise: e.exercise._id,
      order: index,
      targetSets: e.targetSets ?? undefined,
      targetReps: e.targetReps ?? undefined,
      targetWeightKg: e.targetWeightKg ?? undefined,
      targetDurationSec: e.targetDurationSec ?? undefined,
      targetDistanceM: e.targetDistanceM ?? undefined,
      barWeightKg: e.barWeightKg ?? undefined,
      groupId: e.groupId ?? undefined,
      notes: e.notes?.trim() || undefined,
    })),
  }
}

export default function RoutineEditor() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const isNew = !id
  const { routine, loading: loadingRoutine, error: fetchError } = useRoutine(id)

  const [state, setState] = useState({ name: '', description: '', entries: [] })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // Snapshot inicial para detectar cambios no guardados. Comparación JSON
  // porque el objeto es serializable y comparar referencia a referencia da
  // falso positivo cada vez que React re-renderiza.
  const initialRef = useRef(null)
  useEffect(() => {
    if (!isNew && routine) {
      const normalized = normalize(routine)
      initialRef.current = JSON.stringify(normalized)
      setState(normalized)
    } else if (isNew && initialRef.current === null) {
      initialRef.current = JSON.stringify({ name: '', description: '', entries: [] })
    }
  }, [isNew, routine])

  const isDirty =
    initialRef.current !== null && JSON.stringify(state) !== initialRef.current

  /*
    beforeunload: dispara el aviso nativo del navegador si el usuario cierra
    la pestaña o recarga con cambios sin guardar. No cubre la navegación
    interna (SPA), eso lo manejamos con el modal de confirmación nuestro.
  */
  useEffect(() => {
    if (!isDirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function requestLeave() {
    if (isDirty) setLeaveOpen(true)
    else navigate('/routines')
  }

  const alreadyIds = useMemo(
    () => state.entries.map((e) => e.exercise._id),
    [state.entries],
  )

  function updateEntry(i, patch) {
    setState((s) => ({
      ...s,
      entries: s.entries.map((e, idx) => (idx === i ? patch : e)),
    }))
  }

  function move(i, dir) {
    setState((s) => {
      const next = [...s.entries]
      const target = i + dir
      if (target < 0 || target >= next.length) return s
      ;[next[i], next[target]] = [next[target], next[i]]
      return { ...s, entries: next }
    })
  }

  function remove(i) {
    setState((s) => ({ ...s, entries: s.entries.filter((_, idx) => idx !== i) }))
  }

  // Merge/unmerge para la UI de supersets. mergeWithNext toma el entry en
  // `index` y lo agrupa con el siguiente; unmergeAt saca el entry de su
  // grupo (si queda solo un miembro, también se saca por consistencia).
  function groupWithNext(i) {
    setState((s) => ({ ...s, entries: mergeWithNext(s.entries, i) }))
  }
  function ungroup(i) {
    setState((s) => ({ ...s, entries: unmergeAt(s.entries, i) }))
  }

  function addExercise(exercise) {
    const defaults = TRACKING_DEFAULTS[exercise.tracking] ?? {}
    setState((s) => ({
      ...s,
      entries: [
        ...s.entries,
        {
          exercise,
          targetSets: defaults.targetSets ?? null,
          targetReps: defaults.targetReps ?? null,
          targetWeightKg: null,
          targetDurationSec: defaults.targetDurationSec ?? null,
          targetDistanceM: defaults.targetDistanceM ?? null,
          barWeightKg: null,
          groupId: null,
          notes: '',
        },
      ],
    }))
    setPickerOpen(false)
  }

  async function save() {
    setSaveError(null)
    const trimmedName = state.name.trim()
    if (!trimmedName) {
      setSaveError(new Error(t('routines.errors.nameRequired')))
      return
    }
    if (state.entries.length === 0) {
      setSaveError(new Error(t('routines.errors.atLeastOne')))
      return
    }
    setSaving(true)
    try {
      const payload = toApiPayload(state)
      if (isNew) {
        await api('/api/routines', { method: 'POST', body: payload })
      } else {
        await api(`/api/routines/${id}`, { method: 'PATCH', body: payload })
      }
      initialRef.current = JSON.stringify(state) // marca "limpio" antes de navegar
      navigate('/routines')
    } catch (err) {
      setSaveError(err)
      setSaving(false)
    }
  }

  async function doDelete() {
    try {
      await api(`/api/routines/${id}`, { method: 'DELETE' })
      navigate('/routines')
    } catch (err) {
      setSaveError(err)
      setDeleteOpen(false)
    }
  }

  if (!isNew && loadingRoutine) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="h-10 animate-pulse rounded-card bg-surface-2" />
        <div className="h-32 animate-pulse rounded-container bg-surface-2" />
      </div>
    )
  }

  if (!isNew && fetchError) {
    return (
      <div className="mx-auto max-w-3xl text-center text-text-muted">
        {t('routines.errors.notFound')}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={requestLeave}
            className="text-xs text-text-muted hover:text-text"
          >
            ← {t('routines.backToList')}
          </button>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
            {isNew ? t('routines.newTitle') : t('routines.editTitle')}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-error"
          >
            {t('routines.delete')}
          </button>
        )}
      </header>

      <section className="card-liquid flex flex-col gap-3 rounded-container p-4 md:p-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('routines.fields.name')}
          </span>
          <input
            type="text"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            maxLength={60}
            placeholder={t('routines.namePlaceholder')}
            className="rounded-control border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            {t('routines.fields.description')}
          </span>
          <textarea
            value={state.description}
            onChange={(e) =>
              setState((s) => ({ ...s, description: e.target.value }))
            }
            maxLength={500}
            rows={2}
            placeholder={t('routines.descriptionPlaceholder')}
            className="rounded-control border border-border bg-bg px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
        </label>
      </section>

      {/*
        Chips de grupos trabajados: primarios en verde, secundarios en gris
        con etiqueta "sec.". Solo aparecen cuando la rutina tiene ejercicios
        ya elegidos (si no, el bloque quedaría vacío y añadiría ruido). Se
        pintan como un bloque autónomo entre el formulario de nombre y la
        lista de ejercicios: así el usuario ve, de un vistazo, el perfil
        muscular total de la plantilla antes de bajar a editar series.
      */}
      {state.entries.length > 0 && (() => {
        const { primary, secondary } = routineMuscles(state.entries)
        if (primary.length === 0 && secondary.length === 0) return null
        return (
          <section className="card-liquid rounded-container p-4 md:p-5">
            <MuscleChips primary={primary} secondary={secondary} />
          </section>
        )
      })()}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight text-text">
            {t('routines.exercisesTitle', { count: state.entries.length })}
          </h2>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            + {t('routines.addExercise')}
          </button>
        </div>

        {state.entries.length === 0 ? (
          <div className="card-liquid flex flex-col items-center gap-2 rounded-container p-10 text-center">
            <p className="font-display text-base font-semibold text-text">
              {t('routines.emptyTitle')}
            </p>
            <p className="text-sm text-text-muted">{t('routines.emptySub')}</p>
          </div>
        ) : (
          /*
            Renderizamos agrupando por bloques: cada bloque es un run de
            entries CONSECUTIVOS con el mismo groupId. Los bloques con más
            de 1 miembro se envuelven en SupersetBlock (borde acento + chip
            "SUPERSET"); los de 1 miembro renderizan la fila sin wrapper. El
            botón "Agrupar con el siguiente" aparece entre bloques consecutivos
            cuando no están ya enlazados; "Separar" aparece a nivel de bloque.
          */
          <div className="flex flex-col gap-2">
            {groupEntries(state.entries).map((block, bi, blocks) => {
              const isSuperset = block.items.length > 1
              const lastEntryIndex = block.items[block.items.length - 1].index
              const nextBlock = blocks[bi + 1]
              const canLinkToNext = Boolean(nextBlock)
              const rows = block.items.map(({ entry, index }) => (
                <ExerciseEditorRow
                  key={`${entry.exercise._id}-${index}`}
                  entry={entry}
                  onChange={(patch) => updateEntry(index, patch)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onRemove={() => remove(index)}
                  canMoveUp={index > 0}
                  canMoveDown={index < state.entries.length - 1}
                />
              ))
              return (
                <div
                  key={block.groupId ?? `solo-${bi}`}
                  className="flex flex-col gap-2"
                >
                  {isSuperset ? (
                    <SupersetBlock onUngroup={() => ungroup(block.items[0].index)}>
                      {rows}
                    </SupersetBlock>
                  ) : (
                    rows
                  )}
                  {canLinkToNext && (
                    <button
                      type="button"
                      onClick={() => groupWithNext(lastEntryIndex)}
                      className="press mx-auto inline-flex items-center gap-1.5 rounded-pill border border-dashed border-border bg-surface px-3 py-1 text-[11px] font-medium text-text-muted transition-[filter,transform,color,background-color] hover:bg-surface-2 hover:text-text"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {t('routines.linkSuperset')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {saveError && (
        <p className="text-sm text-error">
          {saveError.message ?? t('routines.errors.generic')}
        </p>
      )}

      {/*
        Save bar al final del flujo, no sticky. En mobile un sticky + teclado
        virtual produce la típica barra flotando a media pantalla sobre otros
        inputs. Mejor que el usuario scrollee hasta el final — hay un ancla
        clara y no se come layout. El padding-bottom del main contenedor
        (ya aplicado por AppShell) deja espacio sobre la bottom-nav.
      */}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={requestLeave}
          className="rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          {t('routines.cancel')}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08] disabled:opacity-60"
        >
          {saving ? t('routines.saving') : t('routines.save')}
        </button>
      </div>

      <ExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        alreadyPickedIds={alreadyIds}
      />
      <ConfirmModal
        open={deleteOpen}
        title={t('routines.confirmDeleteTitle')}
        description={t('routines.confirmDeleteSub')}
        confirmLabel={t('routines.delete')}
        onConfirm={doDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <ConfirmModal
        open={leaveOpen}
        title={t('routines.confirmLeaveTitle')}
        description={t('routines.confirmLeaveSub')}
        confirmLabel={t('routines.leaveAnyway')}
        onConfirm={() => {
          setLeaveOpen(false)
          navigate('/routines')
        }}
        onCancel={() => setLeaveOpen(false)}
        destructive={false}
      />
    </div>
  )
}
