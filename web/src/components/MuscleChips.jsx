import { useTranslation } from 'react-i18next'

/*
  Chips de grupos musculares con jerarquía primario/secundario. Reutilizado
  en /stats/week (sesión expandida) y en el detalle de rutina (/routines/:id):
  el mismo lenguaje visual en los dos sitios para que el usuario asocie
  "verde = carga principal, gris con sec. = asistente".

  El componente no decide los datos: recibe las listas ya unificadas. El
  caller se encarga de deduplicar y de quitar secundarios que ya aparecen
  como primarios (ver `breakdownForSession` / `routineMuscles`).
*/
export default function MuscleChips({
  primary = [],
  secondary = [],
  title,
}) {
  const { t } = useTranslation()
  if (primary.length === 0 && secondary.length === 0) return null
  const headline = title ?? t('muscleChips.title')
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {headline}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {primary.map((m) => (
          <span
            key={`p-${m}`}
            className="inline-flex items-center rounded-pill bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent"
          >
            {t(`catalog.muscles.${m}`, { defaultValue: m })}
          </span>
        ))}
        {secondary.map((m) => (
          <span
            key={`s-${m}`}
            className="inline-flex items-center gap-1 rounded-pill border border-border/60 bg-surface px-2.5 py-0.5 text-[11px] text-text-muted"
            title={t('muscleChips.secondaryTitle')}
          >
            {t(`catalog.muscles.${m}`, { defaultValue: m })}
            <span className="text-[9px] uppercase tracking-wider">
              {t('muscleChips.secondaryTag')}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
