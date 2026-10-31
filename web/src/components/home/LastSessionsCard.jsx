import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'

/*
  Lista de "últimas sesiones" como aparece en el mockup. Cada fila comparte
  cuadrado-fecha + nombre + duración + chip del grupo muscular dominante +
  chevron. Si el backend no da el grupo dominante (hoy no lo expone), se
  omite el chip para no mostrar un placeholder vacío.
*/

function monthAbbrev(dateStr, locale) {
  const d = new Date(dateStr)
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short' })
  return fmt.format(d).replace('.', '').toUpperCase()
}

function formatDuration(seconds, locale) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0) return locale.startsWith('en') ? `${h}h ${m}min` : `${h} h ${m} min`
  return `${m} min`
}

function startedTime(dateStr, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateStr))
}

export default function LastSessionsCard({ sessions }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <section className="card-liquid flex h-full flex-col rounded-container p-4 md:p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight text-text">
          {t('home.recentSessions')}
        </h2>
        <Link to="/history" className="text-sm text-link hover:underline">
          {t('home.viewAll')}
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-card bg-surface-2 p-5 text-center">
          <p className="font-semibold text-text">{t('home.noSessionsTitle')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t('home.noSessionsSub')}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const d = new Date(s.startedAt)
            const day = String(d.getDate()).padStart(2, '0')
            return (
              <li key={s._id ?? s.id}>
                <Link
                  to={`/history`}
                  className="press group flex items-center gap-3 rounded-card bg-surface-2 p-3 transition-[background-color,transform] hover:bg-surface-3"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-control bg-bg text-center">
                    <span className="tabular font-display text-base font-semibold leading-none text-text">
                      {day}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium tracking-wide text-text-muted">
                      {monthAbbrev(s.startedAt, locale)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-text">
                      {s.routineName ?? t('home.recentSessions')}
                    </div>
                    <div className="truncate text-xs text-text-muted">
                      <span className="tabular">{startedTime(s.startedAt, locale)}</span>
                      <span> · </span>
                      <span className="tabular">
                        {formatDuration(s.durationSec, locale)}
                      </span>
                      {s.entryCount ? (
                        <>
                          <span> · </span>
                          <span>
                            {t('home.exercisesCount', { count: s.entryCount })}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
