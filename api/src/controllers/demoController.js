import { makeSignature } from 'better-auth/crypto'
import { auth } from '../config/auth.js'
import User from '../models/user.model.js'
import { DEMO_ACCOUNT } from '../models/constants.js'

/*
  Login de la cuenta demo. Sin OAuth: el reclutador entra con un clic.

  Por qué no pasa por Better Auth: su flujo de login (email, OAuth) exige un
  proveedor externo y no hay forma pública de "iniciar sesión como X". Así que
  creamos la sesión con la API interna y escribimos la cookie a mano, con el
  mismo formato que Better Auth firma y lee. La versión de Better Auth está
  fijada en package-lock; si la cambia, `demo.test.js` (ida y vuelta por
  requireSession) lo detecta en vez de romper el login en silencio.

  Qué NO hace: nunca crea la cuenta. Si no existe, responde con un error que
  dice al operador que ejecute `npm run seed:demo`. Crearla aquí permitiría que
  cualquiera con acceso a la ruta fabricase un usuario con datos ajenos.
*/
export async function demoLogin(req, res, next) {
  try {
    const demo = await User.findOne({ email: DEMO_ACCOUNT.email }).select('_id').lean()
    if (!demo) {
      return res.status(503).json({
        message: 'La cuenta demo no existe todavía. Ejecuta `npm run seed:demo` en el servidor.',
      })
    }

    // `auth.$context` es una promesa con el contexto interno de Better Auth:
    // adaptador de base de datos, secreto de firma, nombres de cookies y tiempos
    // de sesión. Es la API pública que expone la librería para esto.
    const ctx = await auth.$context

    // Crea la fila de sesión (token aleatorio, expiración, userId). No es
    // `signIn`: no pasa por contraseñas ni proveedores, solo guarda la sesión.
    const session = await ctx.internalAdapter.createSession(String(demo._id), false)

    // Await obligatorio: la firma es asíncrona y, si respondiéramos antes, el
    // navegador recibiría un 200 sin cookie y el login fallaría sin error visible.
    await setSessionCookie(res, ctx, session.token)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

/**
 * Escribe la cookie de sesión igual que Better Auth.
 *
 * Better Auth guarda `token.firma` (HMAC-SHA256 del token con el secreto), y
 * `requireSession` la valida con `getSession`. Pasamos el valor SIN codificar a
 * `res.cookie`: Express ya lo codifica al serializar. Si lo codificáramos antes,
 * quedaría doble codificado y Better Auth no encontraría la firma.
 *
 * Los atributos (nombre con prefijo __Secure- en https, httpOnly, sameSite,
 * path) vienen de Better Auth para que coincidan con sus propias cookies. Solo
 * cambiamos `maxAge`: Better Auth lo guarda en segundos y Express lo espera en
 * milisegundos.
 */
async function setSessionCookie(res, ctx, token) {
  const { name, attributes } = ctx.authCookies.sessionToken
  const signature = await makeSignature(token, ctx.secret)
  const { maxAge: _ignored, ...cookieAttributes } = attributes
  res.cookie(name, `${token}.${signature}`, {
    ...cookieAttributes,
    maxAge: ctx.sessionConfig.expiresIn * 1000,
  })
}
