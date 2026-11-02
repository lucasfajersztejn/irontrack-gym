/*
  Avatar del usuario: la imagen del proveedor OAuth, y si no hay, la inicial
  sobre una superficie elevada.

  `alt=""` a propósito: el avatar siempre viaja acompañado del nombre o del
  @username en texto, así que para un lector de pantalla es decoración. Un
  alt con el nombre lo haría leer dos veces lo mismo.

  Vivía dentro de AppShell; se extrajo al necesitarlo también la cabecera de
  Ajustes. El tamaño entra por `className` en vez de por una prop `size` con
  un mapa de clases: Tailwind necesita las clases literales en el fuente para
  generarlas, y un mapa interno solo añade una indirección que hay que ir a
  leer.
*/
export default function Avatar({ user, className = 'h-9 w-9 text-sm' }) {
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    )
  }
  const initial = (user?.username ?? user?.name ?? '?').charAt(0).toUpperCase()
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-text`}
    >
      {initial}
    </span>
  )
}
