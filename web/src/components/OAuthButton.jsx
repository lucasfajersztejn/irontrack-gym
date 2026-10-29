/*
  Botón "Continuar con <Proveedor>" del mockup 01-landing. Un rectángulo
  redondeado (radius 14) sobre --color-surface-2, con una pastilla cuadrada
  interna que lleva el icono de marca y un label a su derecha.

  Soporta estado disabled porque GitHub/Microsoft/Discord están pendientes
  de credenciales en el backend. Un chip "Pronto" aparece a la derecha solo
  en ese caso.
*/
export default function OAuthButton({
  label,
  icon: Icon,
  onClick,
  disabled = false,
  comingSoon = false,
}) {
  // Cuando el proveedor aún no está disponible, el chip "Pronto" es decoración
  // visual: el estado real lo lleva el aria-label para lectores de pantalla,
  // así no se les lee "Pronto" como si fuera un segundo botón.
  const ariaLabel = comingSoon ? `${label} (próximamente)` : undefined

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'flex w-full items-center gap-3 rounded-[14px] bg-surface-2 px-4 py-3 text-left transition',
        'border border-transparent',
        disabled
          ? 'cursor-not-allowed opacity-60'
          // -translate-y-px es un empujón de 1 px al pasar el cursor: hace
          // sentir el botón como un elemento físico. Combinado con el
          // active:scale[0.99] genera una micro-respuesta "sube y hunde"
          // sin pedir motion lib ni keyframes. prefers-reduced-motion
          // (index.css) lo neutraliza llevando transition-duration a 0.
          : 'hover:-translate-y-px hover:border-border hover:bg-surface-3 active:scale-[0.99]',
      ].join(' ')}
    >
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-bg">
        <Icon />
      </span>
      <span className="flex-1 text-[15px] font-medium text-text">{label}</span>
      {comingSoon && (
        <span
          aria-hidden="true"
          className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted"
        >
          Pronto
        </span>
      )}
    </button>
  )
}
