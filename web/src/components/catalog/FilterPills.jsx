import { useTranslation } from 'react-i18next'

/*
  Fila de pills horizontales para filtrar por grupo corporal. "Todos" es el
  estado neutro (bodyPart == null). En desktop ocupan una línea; en mobile
  tienen overflow-x-auto con scrollbar-hidden para que un pulgar pueda
  arrastrar entre los grupos sin ver la barra.

  Mantengo el set en 6 body parts (más Todos) y evito "Glúteos" aquí
  porque los glúteos son músculo, no grupo corporal — el mockup los
  mostraba por diseño, pero mezclar los dos conceptos en los pills se
  presta a confusión (¿qué pasa si quiero filtrar por "piernas + glúteos"?).
  Cuando llegue el filtro de músculo lo resolvemos limpio.
*/

const PILLS = [
  { value: null, key: 'catalog.filters.all' },
  { value: 'chest', key: 'catalog.bodyParts.chest' },
  { value: 'back', key: 'catalog.bodyParts.back' },
  { value: 'legs', key: 'catalog.bodyParts.legs' },
  { value: 'shoulders', key: 'catalog.bodyParts.shoulders' },
  { value: 'arms', key: 'catalog.bodyParts.arms' },
  { value: 'core', key: 'catalog.bodyParts.core' },
]

export default function FilterPills({ value, onChange }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map((p) => {
        const active = value === p.value
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.value)}
            className={`rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'border-transparent bg-accent/15 text-accent'
                : 'border-border bg-surface text-text-muted hover:text-text'
            }`}
          >
            {t(p.key)}
          </button>
        )
      })}
    </div>
  )
}
