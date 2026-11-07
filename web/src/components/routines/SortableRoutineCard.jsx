import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RoutineCard from './RoutineCard.jsx'

/*
  Wrapper sortable alrededor de RoutineCard.

  Diseño "slot": la card interna queda a la derecha; a la izquierda, una
  franja vertical del ancho del número ("01", "02", …) que:
    - Grita jerarquía: el número grande se lee de un vistazo y cuenta
      el orden de la rotación — que es la info que el usuario necesita
      para decidir si arrastra o no.
    - Sirve de agarre completo: toda la franja captura los listeners de
      dnd-kit. Más superficie que los 36×36 anteriores → arrastre
      cómodo en mobile sin pelear con el scroll vertical. `touch-none`
      para que iOS no haga scroll al tocar.
    - Diferencia visual: `bg-accent/20` + texto accent. No es el mismo
      verde pleno del CTA (eso rompería Glow-Is-Earned y pelearía con
      el FAB), pero sí lo bastante distinta del fondo surface para que
      el ojo entienda "esto se agarra".

  La card interior se queda tal cual con su Link al editor; el grip de
  puntos en la esquina superior-derecha desaparece de la versión
  anterior porque ya no aporta señal.

  `position` viene desde el padre (el índice del `routines.map`): no lo
  derivamos del campo `order` de la rutina porque mientras arrastramos,
  el reordenamiento es optimista en memoria antes de que el backend
  reciba nada; el `order` de un documento concreto puede llegar a estar
  desactualizado durante esa ventana. El índice visual nunca miente.
*/
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
        // rounded-l-container en la franja y rounded-l-none en la card
        // (flatLeft) → las dos superficies comparten la línea vertical de
        // contacto sin hueco ni arco. Solo redondeamos las esquinas de
        // los extremos exteriores del "slot".
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
