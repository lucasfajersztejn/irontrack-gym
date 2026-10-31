import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'

/*
  Card de "mis rutinas". El summary del backend llega con exerciseCount,
  timesUsed y lastUsedAt — tres datos que pintar; no hace falta pedir
  detalle para la lista. La fecha "usada hace X" se formatea con el locale
  del usuario via Intl.RelativeTimeFormat.
*/

function relativeDate(dateIso, locale) {
  if (!dateIso) return null
  const d = new Date(dateIso)
  const diffDays = Math.round((d - Date.now()) / 86400000)
  const fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(diffDays) < 1) return fmt.format(0, 'day')
  if (Math.abs(diffDays) < 30) return fmt.format(diffDays, 'day')
  if (Math.abs(diffDays) < 365) {
    return fmt.format(Math.round(diffDays / 30), 'month')
  }
  return fmt.format(Math.round(diffDays / 365), 'year')
}

export default function RoutineCard({ routine }) {
  const { t, i18n } = useTranslation()
  const lastUsed = relativeDate(routine.lastUsedAt, i18n.language)

  return (
    <Link
      to={`/routines/${routine._id}`}
      className="card-liquid press group flex flex-col gap-3 rounded-container p-4 transition-[filter,transform] hover:brightness-[1.08] md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 font-display text-lg font-semibold tracking-tight text-text">
          {routine.name}
        </h3>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      {routine.description && (
        <p className="line-clamp-2 text-sm text-text-muted">
          {routine.description}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="tabular">
          {t('routines.exerciseCount', { count: routine.exerciseCount })}
        </span>
        {routine.timesUsed > 0 && (
          <>
            <span>·</span>
            <span className="tabular">
              {t('routines.timesUsed', { count: routine.timesUsed })}
            </span>
          </>
        )}
        {lastUsed && (
          <>
            <span>·</span>
            <span>{t('routines.lastUsed', { when: lastUsed })}</span>
          </>
        )}
      </div>
    </Link>
  )
}
