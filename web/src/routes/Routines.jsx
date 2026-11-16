// Routines list route: view, reorder (drag-and-drop) and manage workout templates.

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import SortableRoutineCard from '../components/routines/SortableRoutineCard.jsx'
import { useRoutines } from '../lib/useRoutines.js'

function NewRoutineButton() {
  const { t } = useTranslation()
  return (
    <Link
      to="/routines/new"
      className="inline-flex items-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-[filter] hover:brightness-[1.08]"
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
        <path d="M12 5v14M5 12h14" />
      </svg>
      {t('routines.newRoutine')}
    </Link>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-48 rounded-card bg-surface-2" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-container bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

export default function Routines() {
  const { t } = useTranslation()
  const { loading, error, routines, reorder } = useRoutines()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = routines.findIndex((r) => r._id === active.id)
    const newIndex = routines.findIndex((r) => r._id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(routines, oldIndex, newIndex)
    reorder(next).catch(() => {})
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 md:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text md:text-4xl">
            {t('routines.title')}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading
              ? t('routines.loading')
              : t('routines.countSummary', { count: routines.length })}
          </p>
        </div>
        <NewRoutineButton />
      </header>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="card-liquid flex flex-col items-center gap-3 rounded-container p-10 text-center">
          <p className="font-display text-base font-semibold text-text">
            {t('routines.errorTitle')}
          </p>
          <p className="text-sm text-text-muted">{t('routines.errorSub')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-control border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-2"
          >
            {t('routines.retry')}
          </button>
        </div>
      ) : routines.length === 0 ? (
        <div className="card-liquid flex flex-col items-center gap-3 rounded-container p-10 text-center">
          <p className="font-display text-base font-semibold text-text">
            {t('routines.emptyListTitle')}
          </p>
          <p className="text-sm text-text-muted">{t('routines.emptyListSub')}</p>
          <div className="mt-2">
            <NewRoutineButton />
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            {t('routines.reorderHint')}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={routines.map((r) => r._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {routines.map((r, idx) => (
                  <SortableRoutineCard
                    key={r._id}
                    routine={r}
                    position={idx}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  )
}
