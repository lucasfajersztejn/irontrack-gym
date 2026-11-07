import { motion, useReducedMotion } from 'motion/react'

/*
  Tarjeta de estadística reutilizable. El número grande usa font-display para
  dar jerarquía (DESIGN.md) y .tabular para que una variación de 1 dígito no
  salte el ancho. El slot `footer` acepta nodo libre: barra de progreso,
  chip "Récord", gráfico pequeño, etc.

  Prop `size`:
    - `"md"` (default): padding e interlineado compactos. Para grids de 3.
    - `"lg"`: más padding y la cifra escala hasta 3.25rem. Se usa en las
      dos tiles del bloque Actividad (Racha + Esta semana) porque viven
      en grid-cols-2 junto al dashboard semanal y en móvil se veían
      enanas frente a las cards grandes de abajo.
*/
export default function StatTile({
  icon,
  label,
  value,
  suffix,
  footer,
  index = 0,
  size = 'md',
}) {
  const reduce = useReducedMotion()
  const large = size === 'lg'
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduce ? 0 : index * 0.05 }}
      className={`card-liquid flex h-full flex-col gap-2 rounded-container ${
        large ? 'p-4 md:p-6' : 'p-3 md:p-5'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {/*
        min-w-0 deja que la fila se encoja dentro de la card; sin él, el
        contenido fuerza su ancho natural y el sufijo se sale (grid de 3
        columnas en móviles estrechos). La cifra es fluida: con `lg`
        el techo sube a 3.25rem para equiparar la altura visual al
        dashboard semanal que se renderiza debajo.
      */}
      <div className="flex min-w-0 items-baseline gap-1 md:gap-2">
        <span
          className={`tabular font-display font-semibold leading-none tracking-tight text-text ${
            large
              ? 'text-[clamp(1.5rem,7vw,3.25rem)]'
              : 'text-[clamp(1.25rem,5vw,2.5rem)]'
          }`}
        >
          {value}
        </span>
        {suffix && (
          <span className="shrink-0 text-sm text-text-muted">{suffix}</span>
        )}
      </div>
      {footer && <div className="mt-auto">{footer}</div>}
    </motion.article>
  )
}
