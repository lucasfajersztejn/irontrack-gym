// Catalog grid card for one exercise: GIF thumbnail, name and muscle chips.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import FavoriteButton from './FavoriteButton.jsx'
import { useExerciseName } from '../../lib/exerciseName.js'

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

export default function ExerciseCard({ exercise, onClick }) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const { name } = useExerciseName(exercise)
  const isCustom = Boolean(exercise.createdBy)

  const content = (
    <>
      <div className="relative">
        <GifThumb
          src={exercise.gifUrl}
          loaded={loaded}
          failed={failed}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
        <div className="absolute right-1.5 top-1.5">
          <FavoriteButton exerciseId={exercise._id} />
        </div>
      </div>
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
    </>
  )

  if (onClick) {
    const handleKey = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick(exercise)
      }
    }
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={() => onClick(exercise)}
        onKeyDown={handleKey}
        className="card-liquid press group flex cursor-pointer flex-col gap-3 rounded-container p-3 text-left transition-[filter,transform] hover:brightness-[1.08]"
      >
        {content}
      </article>
    )
  }

  return (
    <article className="card-liquid group flex flex-col gap-3 rounded-container p-3 transition-[filter] hover:brightness-[1.08]">
      {content}
    </article>
  )
}
