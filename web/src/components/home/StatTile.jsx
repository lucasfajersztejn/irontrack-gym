import { motion, useReducedMotion } from 'motion/react'

/*
  Tarjeta de estadística reutilizable. El número grande usa font-display para
  dar jerarquía (DESIGN.md) y .tabular para que una variación de 1 dígito no
  salte el ancho. El slot `footer` acepta nodo libre: barra de progreso,
  chip "Récord", gráfico pequeño, etc.
*/
export default function StatTile({
  icon,
  label,
  value,
  suffix,
  footer,
  index = 0,
}) {
  const reduce = useReducedMotion()
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduce ? 0 : index * 0.05 }}
      className="card-liquid flex h-full flex-col gap-3 rounded-container p-4 md:p-5"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
        <span>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      {/*
        min-w-0 deja que la fila se encoja dentro de la card; sin él, el
        contenido fuerza su ancho natural y el sufijo se sale (grid de 3
        columnas en móviles estrechos). La cifra es fluida: escala con el
        ancho del viewport con un suelo legible y un techo de 2.5rem para
        no crecer de más en desktop (jerarquía de DESIGN.md intacta).
      */}
      <div className="flex min-w-0 items-baseline gap-1 md:gap-2">
        <span className="tabular font-display text-[clamp(1.5rem,6.5vw,2.5rem)] font-semibold leading-none tracking-tight text-text">
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
