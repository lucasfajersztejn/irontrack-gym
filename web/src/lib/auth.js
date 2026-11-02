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

/*
  Helper fino sobre signIn.social. Centraliza el callbackURL para que el
  usuario aterrice siempre en /home tras el OAuth: si falta el username, el
  ProtectedRoute lo mandará a /onboarding por su cuenta.

  El callbackURL debe ser absoluto. Si se pasa como ruta relativa ("/home"),
  Better Auth lo resuelve contra su propio BETTER_AUTH_URL (el backend en
  localhost:5000) y el usuario aterriza allí en lugar de volver al frontend.
  `window.location.origin` da la URL correcta tanto en dev (5173) como en
  producción. El dominio tiene que estar en CORS_ORIGINS del backend para
  que entre en trustedOrigins y Better Auth lo acepte.
*/
export function signInWithProvider(provider) {
  return authClient.signIn.social({
    provider,
    callbackURL: `${window.location.origin}/home`,
  })
}

/*
  Los métodos del cliente devuelven `{ data, error }` en vez de lanzar. Estos
  dos helpers lo convierten en una promesa que lanza, para que las pantallas
  usen try/catch como con `api()` y no tengan dos estilos de manejo de error
  conviviendo en el mismo componente.
*/
function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message ?? error.statusText ?? 'auth error')
    err.status = error.status
    throw err
  }
  return data
}

/*
  Proveedores OAuth vinculados a la cuenta. Se consulta solo en Ajustes, que
  es el único sitio donde importa: meterlo en `/api/me` añadiría una lectura
  a cada arranque de la PWA para un dato que se mira una vez al mes.
*/
export async function listLinkedProviders() {
  return unwrap(await authClient.listAccounts()) ?? []
}

/*
  Borrado de cuenta. Better Auth borra `users`, `accounts` y `sessions`, y el
  hook `beforeDelete` del backend (config/auth.js) borra sesiones, rutinas y
  ejercicios custom de IronTrack antes. También limpia la cookie de sesión,
  así que al volver el usuario ya es un invitado: basta con refrescar
  UserContext y salir a la landing.
*/
export async function deleteAccount() {
  return unwrap(await authClient.deleteUser())
}
