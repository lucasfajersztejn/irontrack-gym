import { useCallback, useMemo } from 'react'
import { useUser } from '../contexts/UserContext.jsx'
import { api } from './api.js'

/*
  Toggle de favoritos SIN refetch de /api/me:
  1. Actualizamos user.favoriteExercises localmente (optimista) para que la
     mancuerna se pinte amarilla al instante.
  2. Disparamos PUT/DELETE. Si va bien, reconciliamos con lo que devuelve el
     servidor (`{ favoriteExercises }`) — por si llegaba un cambio concurrente.
  3. Si falla, rollback al snapshot que teníamos antes.

  Antes esto llamaba a refetch() del UserContext, que pone loading=true y
  cascada un re-render con flash a toda la app. Esta versión toca solo el
  campo necesario y es imperceptible.
*/
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
        // Reconciliar con el servidor: dedupe + orden autoritativo. En la
        // práctica es el mismo array, pero cubre carrera con otra pestaña.
        if (res?.favoriteExercises) {
          updateUser({ favoriteExercises: res.favoriteExercises })
        }
      } catch (err) {
        // Rollback al snapshot anterior y propagamos para que el caller pueda
        // mostrar error puntual (hoy nadie lo captura, el usuario reintenta).
        updateUser({ favoriteExercises: current })
        throw err
      }
    },
    [user?.favoriteExercises, favoriteSet, updateUser],
  )

  return { favoriteSet, isFavorite, toggle, count: favoriteSet.size }
}
