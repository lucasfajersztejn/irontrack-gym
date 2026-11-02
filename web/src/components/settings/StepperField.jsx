import { useId, useState } from 'react'

/*
  Campo numérico con −/+ y escritura directa.

  Las dos vías existen porque sirven a dos usos distintos: el peso de la
  barra se escribe una vez en la vida (17,5 a mano es más rápido que siete
  toques) y el objetivo semanal se mueve de uno en uno. Quitar los botones
  obliga a abrir el teclado para subir de 4 a 5 sesiones; quitar el input
  obliga a martillear para llegar a 45 kg.

  El valor que se pinta es un borrador local, no la prop: mientras escribes,
  el campo pasa por estados que no son números válidos ("1", "", "17,"). Si
  cada tecla fuera directa al servidor, borrar para reescribir mandaría un
  PATCH con el campo vacío. Se confirma al salir del campo o con Enter, y
  ahí se valida: fuera de rango se recorta, basura revierte al valor actual.

  Los botones sí confirman al instante — ahí no hay estado intermedio
  posible, el salto ya es un valor válido por construcción.

  `type="number"` en lugar de texto con `inputMode`: trae el teclado
  numérico en móvil y las flechas del teclado físico gratis. Las flechitas
  nativas las esconde index.css en todo el proyecto porque no encajan con la
  paleta oscura.
*/
export default function StepperField({
  label,
  helper,
  value,
  min,
  max,
  step,
  suffix,
  decLabel,
  incLabel,
  onChange,
  error,
}) {
  const labelId = useId()
  const [draft, setDraft] = useState(String(value))
  const [lastValue, setLastValue] = useState(value)

  /*
    El valor puede cambiar por debajo del borrador: rollback de un PATCH que
    falló, o el valor autoritativo que devuelve el servidor. Cuando pasa, el
    borrador tiene que seguirlo o el campo mostraría un número que ya no es
    el guardado.

    Se ajusta en el render y no en un `useEffect`: es el patrón que
    documenta React para "corregir estado cuando cambia una prop". El efecto
    equivalente pinta primero el valor viejo y luego el nuevo — dos renders
    y un parpadeo — mientras que este setState durante el render hace que
    React descarte el render en curso y repita con el valor bueno antes de
    tocar el DOM.
  */
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(String(value))
  }

  function clamp(n) {
    return Math.min(max, Math.max(min, n))
  }

  function commit() {
    // Coma decimal: en español se teclea 17,5 y Number() lo lee como NaN.
    const parsed = Number(String(draft).replace(',', '.'))
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clamp(parsed)
    setDraft(String(next))
    onChange(next)
  }

  function nudge(delta) {
    // Redondeo a 2 decimales: sumar 2.5 en coma flotante puede dejar
    // 17.500000000000004, y ese número acabaría en la base de datos.
    const next = clamp(Math.round((value + delta) * 100) / 100)
    setDraft(String(next))
    onChange(next)
  }

  const buttonClass =
    'press flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-lg font-semibold text-text transition-[filter,transform,background-color] hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'

  /*
    En móvil el control va debajo del texto, no al lado. A 360 px, con el
    stepper ocupando ~150 px a la derecha, la etiqueta y su ayuda se quedan
    con 170 px y la ayuda cae en cuatro líneas rotas. Desde `md` ya hay
    sitio de sobra y la fila se lee mejor en horizontal.
  */
  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-text">
          {label}
        </p>
        {helper && (
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{helper}</p>
        )}
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>

      <div
        role="group"
        aria-labelledby={labelId}
        className="flex shrink-0 items-center gap-1 self-start rounded-control bg-bg p-1 md:self-auto"
      >
        <button
          type="button"
          onClick={() => nudge(-step)}
          disabled={value <= min}
          aria-label={decLabel}
          className={buttonClass}
        >
          −
        </button>

        <label className="flex items-baseline gap-1">
          <span className="sr-only">{label}</span>
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            className="tabular w-12 rounded-card bg-transparent py-2 text-center font-display text-base font-semibold text-text outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {suffix && (
            <span aria-hidden className="text-xs text-text-muted">
              {suffix}
            </span>
          )}
        </label>

        <button
          type="button"
          onClick={() => nudge(step)}
          disabled={value >= max}
          aria-label={incLabel}
          className={buttonClass}
        >
          +
        </button>
      </div>
    </div>
  )
}
