// Drag-and-drop wrapper around RoutineCard (dnd-kit sortable).

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RoutineCard from './RoutineCard.jsx'

export default function SortableRoutineCard({ routine, position }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: routine._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  const label = String(position + 1).padStart(2, '0')

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-stretch rounded-container"
    >
      <button
        type="button"
        aria-label={`Reordenar: posición ${label}`}
        className="press flex w-11 shrink-0 touch-none items-center justify-center rounded-l-container bg-accent/20 font-display text-xl font-semibold tabular-nums text-accent transition-[filter] hover:bg-accent/25 active:bg-accent/30 md:w-14 md:text-2xl"
        {...attributes}
        {...listeners}
      >
        {label}
      </button>
      <div className="min-w-0 flex-1">
        <RoutineCard routine={routine} flatLeft />
      </div>
    </div>
  )
}
