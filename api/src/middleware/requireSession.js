import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../config/auth.js'

/** Reject with 401 when there is no valid Better Auth session */
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
