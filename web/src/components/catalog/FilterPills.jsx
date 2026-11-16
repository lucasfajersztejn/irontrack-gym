// Body-part quick-filter pills for the catalog.

import { useTranslation } from 'react-i18next'

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
