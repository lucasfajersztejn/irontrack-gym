/*
  Grupo de ajustes: un kicker en mayúsculas y una card con las filas
  separadas por divisores.

  Los grupos no están ordenados por tipo de dato (números, textos, toggles)
  sino por el momento en el que el usuario los toca: lo que cambia cómo se
  entrena, lo que cambia la app, y la cuenta. Un ajuste se busca por para-qué,
  no por qué forma tiene su control.

  El indicador de guardado vive aquí, al lado del título del grupo, y no en
  cada fila. Los campos se guardan solos al cambiar, así que hace falta
  confirmación visible; pero reservar hueco para ella dentro de cada fila
  empuja el layout cada vez que aparece. Un solo indicador por grupo está
  siempre a la vista del control que acabas de tocar (los grupos son cortos)
  y no mueve nada. `aria-live="polite"` para que también se anuncie.
*/
export default function SettingsSection({ title, status, children }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
          {title}
        </h2>
        <p
          aria-live="polite"
          className={`text-[11px] font-medium ${
            status?.tone === 'saved' ? 'text-accent' : 'text-text-muted'
          }`}
        >
          {status?.label ?? ''}
        </p>
      </div>
      <div className="card-liquid flex flex-col divide-y divide-border rounded-container">
        {children}
      </div>
    </section>
  )
}
