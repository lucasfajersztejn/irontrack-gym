import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRightIcon } from '../icons/NavIcons.jsx'

/*
  Fila compacta del catálogo (mobile). Thumbnail cuadrado pequeño a la
  izquierda, nombre + chips a la derecha, chevron de affordance. Densidad
  mayor que la card de desktop porque en mobile el usuario está decidiendo
  "¿cuál era este?" entre serie y serie — necesita escanear.
*/

function Thumb({ src }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-card bg-bg">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="9" r="1.5" />
            <path d="m21 15-5-5-11 11" />
          </svg>
        </div>
      )}
    </div>
  )
}

function Chip({ children, tone = 'default' }) {
  const styles = {
    default: 'bg-bg text-text',
    muscle: 'bg-accent/15 text-accent',
    custom: 'bg-link/15 text-link',
  }
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  )
}

export default function ExerciseRow({ exercise }) {
  const { t, i18n } = useTranslation()
  const name =
    exercise.name?.[i18n.language] ?? exercise.name?.es ?? exercise.name?.en ?? '—'
  const isCustom = Boolean(exercise.createdBy)

  return (
    <article className="card-liquid group flex items-center gap-3 rounded-container p-3 transition-[filter] hover:brightness-[1.08]">
      <Thumb src={exercise.gifUrl} />
      {/*
        Mismo patrón que en ExerciseCard: alto mínimo de 2 líneas en el
        nombre fija la posición vertical de chip y equipamiento en toda la
        lista. En mobile es más cantoso porque las filas se escanean una
        detrás de otra y cualquier salto desalinea el ojo.
      */}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 min-h-[2.1rem] font-display text-sm font-semibold leading-tight text-text">
          {name}
        </h3>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip tone="muscle">
            {t(`catalog.muscles.${exercise.muscle}`, { defaultValue: exercise.muscle })}
          </Chip>
          {isCustom && <Chip tone="custom">{t('catalog.custom')}</Chip>}
        </div>
        <span className="mt-1 block text-[11px] text-text-muted">
          {t(`catalog.equipment.${exercise.equipment}`, {
            defaultValue: exercise.equipment,
          })}
        </span>
      </div>
      <ChevronRightIcon className="h-4 w-4 text-text-muted" />
    </article>
  )
}
