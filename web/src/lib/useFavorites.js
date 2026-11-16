import { useCallback, useMemo } from 'react'
import { useUser } from '../contexts/UserContext.jsx'
import { api } from './api.js'

// Hook for favorite exercises.
export function useFavorites() {
  const { user, updateUser } = useUser()

  const favoriteSet = useMemo(
    () => new Set((user?.favoriteExercises ?? []).map(String)),
    [user?.favoriteExercises],
  )

  const isFavorite = useCallback(
    (exerciseId) => favoriteSet.has(String(exerciseId)),
    [favoriteSet],
  )

  const toggle = useCallback(
    async (exerciseId) => {
      const current = user?.favoriteExercises ?? []
      const already = favoriteSet.has(String(exerciseId))
      const optimistic = already
        ? current.filter((id) => String(id) !== String(exerciseId))
        : [...current, exerciseId]

      updateUser({ favoriteExercises: optimistic })
      try {
        const res = await api(`/api/me/favorites/${exerciseId}`, {
          method: already ? 'DELETE' : 'PUT',
        })
        if (res?.favoriteExercises) {
          updateUser({ favoriteExercises: res.favoriteExercises })
        }
      } catch (err) {
        updateUser({ favoriteExercises: current })
        throw err
      }
    },
    [user?.favoriteExercises, favoriteSet, updateUser],
  )

  return { favoriteSet, isFavorite, toggle, count: favoriteSet.size }
}
