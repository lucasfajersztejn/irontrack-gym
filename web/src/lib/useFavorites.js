import { useCallback, useMemo } from 'react'
import { useUser } from '../contexts/UserContext.jsx'
import { api } from './api.js'

/*
  Toggle optimista de favoritos. Lee la lista desde `user.favoriteExercises`
  (viene en /api/me) y escribe con PUT/DELETE /api/me/favorites/:id.
  Mantenemos el estado al día refrescando el user del contexto tras cada
  cambio: así el icono de favorito en catálogo, picker y futuras pantallas
  comparte una única fuente de verdad.

  No optimizamos (optimistic update local sin refetch) todavía porque la
  lista semilla es pequeña (<100 ids) y el refetch de /api/me es barato.
  Cuando el perfil crezca con más campos, mueve a optimistic + rollback en
  caso de error.
*/
export function useFavorites() {
  const { user, refetch } = useUser()

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
      const already = favoriteSet.has(String(exerciseId))
      try {
        await api(`/api/me/favorites/${exerciseId}`, {
          method: already ? 'DELETE' : 'PUT',
        })
        await refetch()
      } catch (err) {
        // Dejamos propagar para que el caller pueda enseñar un error puntual
        // si lo necesita. Hoy nadie lo captura; el usuario reintenta.
        throw err
      }
    },
    [favoriteSet, refetch],
  )

  return { favoriteSet, isFavorite, toggle, count: favoriteSet.size }
}
