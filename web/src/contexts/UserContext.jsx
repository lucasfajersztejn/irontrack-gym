import { createContext, useContext } from 'react'

/*
  Context del usuario logueado (spec §2). Context y no Zustand porque cambia
  poco: pasa del `null` inicial al perfil tras `/api/me`, y de ahí casi no se
  toca. El contenido real se enganchará cuando codeemos el flujo de login.
*/
const UserContext = createContext({ user: null, loading: true })

export function UserProvider({ value, children }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  return useContext(UserContext)
}
