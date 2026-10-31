import { useTranslation } from 'react-i18next'

/*
  Fila secundaria de filtros: dropdown de equipamiento + toggle "Mis custom".
  El native select va bien aquí: cumple con teclado, con el screen reader de
  gimnasio (si existe) y evita montarnos un combobox a mano.
*/

const EQUIPMENT_VALUES = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'band',
  'kettlebell',
  'smith',
  'ez-bar',
  'lever',
  'sled',
  'other',
]

export default function FiltersBar({
  equipment,
  mine,
  onEquipmentChange,
  onMineChange,
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative inline-flex items-center">
        <select
          value={equipment ?? ''}
          onChange={(e) => onEquipmentChange(e.target.value || null)}
          className="appearance-none rounded-pill border border-border bg-surface py-1.5 pl-3.5 pr-8 text-sm text-text focus:border-accent focus:outline-none"
          aria-label={t('catalog.filters.equipment')}
        >
          <option value="">{t('catalog.filters.equipmentAny')}</option>
          {EQUIPMENT_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(`catalog.equipment.${v}`)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 text-text-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </label>

      <button
        type="button"
        onClick={() => onMineChange(!mine)}
        aria-pressed={mine}
        className={`rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors ${
          mine
            ? 'border-transparent bg-accent/15 text-accent'
            : 'border-border bg-surface text-text-muted hover:text-text'
        }`}
      >
        {t('catalog.filters.mine')}
      </button>
    </div>
  )
}
