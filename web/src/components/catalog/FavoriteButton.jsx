// Star toggle to add or remove an exercise from favorites.

import { useTranslation } from 'react-i18next'
import { DumbbellIcon } from '../icons/NavIcons.jsx'
import { useFavorites } from '../../lib/useFavorites.js'

export default function FavoriteButton({ exerciseId, size = 'md' }) {
  const { t } = useTranslation()
  const { isFavorite, toggle } = useFavorites()
  const fav = isFavorite(exerciseId)

  const sizes = {
    sm: { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
    md: { btn: 'h-8 w-8', icon: 'h-4 w-4' },
  }
  const s = sizes[size] ?? sizes.md

  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? t('favorites.remove') : t('favorites.add')}
      onClick={(e) => {
        e.stopPropagation()
        toggle(exerciseId).catch(() => {})
      }}
      className={`press flex ${s.btn} items-center justify-center rounded-full bg-bg/70 backdrop-blur-sm transition-[filter,transform,color] ${
        fav ? 'text-warn' : 'text-text-muted hover:text-text'
      }`}
    >
      <DumbbellIcon className={s.icon} />
    </button>
  )
}
