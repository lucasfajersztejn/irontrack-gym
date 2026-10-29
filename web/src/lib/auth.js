import { createAuthClient } from 'better-auth/react'

/*
  Cliente de Better Auth. En dev el proxy de Vite (ver vite.config.js) hace
  que `/api/auth/*` llegue al backend en localhost:3000, así que no fijamos
  baseURL. Para producción se setea VITE_AUTH_URL por entorno.
*/
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? window.location.origin,
})

export const { useSession, signIn, signOut } = authClient
