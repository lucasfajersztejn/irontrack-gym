/*
  Campo de opciones excluyentes como control segmentado.

  Por qué segmentado y no un <select>: son dos a cinco opciones cortas y
  todas caben a la vista. Un desplegable esconde el abanico detrás de un
  toque y, en móvil, abre la rueda nativa del sistema — que se come media
  pantalla para elegir entre "Español" e "English".

  Accesibilidad: por debajo son radios nativos dentro de un <fieldset> con
  <legend>. Esa es la razón de no montarlo con <button aria-pressed>: los
  radios con el mismo `name` ya forman un grupo que el lector de pantalla
  anuncia como "1 de 4" y que se recorre con las flechas, sin escribir ni
  una línea de manejo de teclado. El input va `sr-only` (no `hidden`, que lo
  saca del árbol de accesibilidad y del foco) y el estado lo pinta el <span>
  hermano con `peer-checked`.

  El foco se dibuja sobre el <span>, porque el input real es invisible: sin
  `peer-focus-visible` el anillo global de :focus-visible caería en un
  elemento de 1 px y navegar con teclado sería a ciegas.
*/

// Tailwind necesita las clases literales en el fuente, así que el número de
// columnas sale de un mapa y no de una plantilla con interpolación.
const COLUMNS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  // La sexta columna solo aparece si el valor guardado no es ninguno de los
  // presets (un PATCH hecho a mano contra la API). Preferimos apretar el
  // control a mentir sobre lo que hay guardado.
  6: 'grid-cols-6',
}

export default function SegmentedField({
  name,
  label,
  helper,
  value,
  options,
  onChange,
  error,
}) {
  return (
    <fieldset className="p-4 md:p-5">
      {/*
        `float-left w-full` no es decorativo. Un <legend> normal se dibuja
        dentro del borde del <fieldset>, y el `padding-block-start` del
        fieldset se aplica DESPUÉS de él: medido en el navegador, eso dejaba
        24 px entre la etiqueta y su ayuda aquí contra 4 px en las filas de
        StepperField, dentro de la misma card. Flotarlo lo devuelve al flujo
        normal y las dos clases de fila comparten ritmo.
      */}
      <legend className="float-left w-full text-sm font-medium text-text">
        {label}
      </legend>
      {helper && (
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-text-muted">
          {helper}
        </p>
      )}

      <div
        className={`mt-3 grid gap-1 rounded-control bg-bg p-1 ${
          COLUMNS[options.length] ?? 'grid-cols-2'
        }`}
      >
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label key={String(option.value)} className="relative flex">
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`press tabular w-full cursor-pointer rounded-card px-1 py-3 text-center text-xs font-medium transition-[filter,transform,background-color,color] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  checked
                    ? 'bg-surface-2 font-semibold text-accent'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {option.label}
              </span>
            </label>
          )
        })}
      </div>

      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </fieldset>
  )
}
