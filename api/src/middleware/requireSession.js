import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../config/auth.js'

/**
 * Rechaza con 401 si el request no trae una sesión válida de Better Auth.
 *
 * `fromNodeHeaders` convierte los headers "crudos" de Node (un objeto plano)
 * en una instancia de `Headers` del estándar Fetch, que es lo que Better Auth
 * entiende. Si la sesión existe, deja al controlador el `user` y el `session`
 * pegados al `req`.
 */
export async function requireSession(req, res, next) {
  try {
    const result = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })
    if (!result?.session || !result.user) {
      return res.status(401).json({ message: 'No autenticado' })
    }
    req.user = result.user
    req.session = result.session
    next()
  } catch (err) {
    next(err)
  }
}
