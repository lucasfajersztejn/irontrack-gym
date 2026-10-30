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
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
        <span className="text-accent">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular font-display text-[2.5rem] font-semibold leading-none tracking-tight text-text">
          {value}
        </span>
        {suffix && (
          <span className="text-sm text-text-muted">{suffix}</span>
        )}
      </div>
      {footer && <div className="mt-auto">{footer}</div>}
    </motion.article>
  )
}
