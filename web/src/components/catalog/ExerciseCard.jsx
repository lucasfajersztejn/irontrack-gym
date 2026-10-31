import { useState } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Card del catálogo (desktop). GIF cuadrado grande arriba, nombre debajo,
  chips de músculo + equipamiento al pie. Si el ejercicio es custom del
  usuario, aparece un chip azul "Custom" junto a los otros.

  El GIF se enlaza al CDN de jsDelivr tal como lo trae el backend; no se
  descarga ni se transforma. Mientras carga, mostramos un placeholder
  tonal para evitar layout shift (los GIFs del catálogo son todos
  cuadrados ~600×600).
*/

function PlaceholderIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
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
  )
}

/*
  GIF con fallback a placeholder. Dos razones para fallar: el ejercicio no
  trae gifUrl (custom del usuario) o el CDN cae/404 (red o versión del
  dataset). En los dos casos pintamos el icono por defecto — nunca una
  <img> rota.
*/
function GifThumb({ src, loaded, failed, onLoad, onError }) {
  const showPlaceholder = !src || failed
  return (
    <div className="relative aspect-square overflow-hidden rounded-card bg-bg">
      {!showPlaceholder && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={onLoad}
          onError={onError}
        />
      )}
      {showPlaceholder && (
        <div className="flex h-full w-full items-center justify-center text-text-muted">
          <PlaceholderIcon size={32} />
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
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  )
}

export default function ExerciseCard({ exercise }) {
  const { t, i18n } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const name =
    exercise.name?.[i18n.language] ?? exercise.name?.es ?? exercise.name?.en ?? '—'
  const isCustom = Boolean(exercise.createdBy)

  return (
    <article className="card-liquid group flex flex-col gap-3 rounded-container p-3 transition-[filter] hover:brightness-[1.08]">
      <GifThumb
        src={exercise.gifUrl}
        loaded={loaded}
        failed={failed}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {/*
        min-h de 2 líneas en el nombre bloquea la posición del chip y del
        equipamiento: aunque el nombre sea de una sola línea, reserva el
        espacio de dos, así todos los cards presentan el chip a la misma
        altura y el equipamiento también. line-clamp-2 corta por arriba si
        el nombre fuera más largo. Fija el ritmo vertical sin fijar la
        altura del card: la rejilla sigue decidiendo cuánto mide cada fila.
      */}
      <div className="flex flex-col gap-1.5">
        <h3 className="line-clamp-2 min-h-[2.1rem] font-display text-sm font-semibold leading-tight text-text">
          {name}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Chip tone="muscle">
            {t(`catalog.muscles.${exercise.muscle}`, { defaultValue: exercise.muscle })}
          </Chip>
          {isCustom && <Chip tone="custom">{t('catalog.custom')}</Chip>}
        </div>
        <span className="text-xs text-text-muted">
          {t(`catalog.equipment.${exercise.equipment}`, {
            defaultValue: exercise.equipment,
          })}
        </span>
      </div>
    </article>
  )
}
