import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import i18n from '../i18n/index.js'
import { api } from '../lib/api.js'

/*
  Fuente de verdad del estado de autenticación en el frontend. Una sola
  llamada a /api/me resuelve dos preguntas: ¿hay sesión? y ¿tiene username?
  Usar también authClient.useSession() de Better Auth sería duplicar estado
  y abrir carreras entre ambas respuestas. Mejor uno manda, el otro queda
  para llamar signIn/signOut.

  Un 401 no es un error ruidoso: significa "no autenticado" y es el estado
  habitual al abrir la Landing. Cualquier otro error sí se registra.
*/
const UserContext = createContext({
  user: null,
  loading: true,
  isAuthed: false,
  needsOnboarding: false,
  refetch: () => {},
  updateUser: () => {},
})

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    setLoading(true)
    try {
      const me = await api('/api/me')
      setUser(me)
    } catch (err) {
      if (err.status !== 401) {
        console.error('GET /api/me falló:', err)
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  /*
    El usuario eligió su idioma en el onboarding y vive en settings.locale.
    Sin esto, i18next se queda con el idioma del navegador y la Home ignora
    la preferencia del usuario tras un login desde otro equipo.
  */
  useEffect(() => {
    const locale = user?.settings?.locale
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [user?.settings?.locale])

  /*
    updateUser: merge local sin ir al servidor. Para cuando un endpoint ya
    devuelve el estado actualizado (p. ej. PUT /api/me/favorites responde
    { favoriteExercises }) y no queremos pagar un refetch de /api/me entero
    — el refetch pone loading=true y hace parpadear a toda la app.
  */
  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const value = {
    user,
    loading,
    isAuthed: !!user,
    needsOnboarding: !!user?.needsOnboarding,
    refetch: fetchMe,
    updateUser,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  return useContext(UserContext)
}
