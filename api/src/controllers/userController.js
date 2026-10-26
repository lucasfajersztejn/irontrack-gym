import { z } from 'zod'
import User from '../models/user.model.js'
import { RESERVED_USERNAMES } from '../models/constants.js'

/**
 * GET /api/me
 *
 * Devuelve el perfil del usuario autenticado + la señal `needsOnboarding`
 * para que el router del frontend sepa si tiene que llevarlo al wizard de
 * username. Decisión defendida en entrevista:
 *   "el servidor expone estado; el cliente expresa flujo".
 */
export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).lean()
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    return res.json({
      id: user._id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name ?? null,
      image: user.image ?? null,
      username: user.username ?? null,
      privacy: user.privacy ?? 'private',
      settings: user.settings ?? null,

      // La única señal "derivada" del endpoint: el frontend NO calcula esto
      // (no sabe si vamos a añadir más condiciones de onboarding mañana).
      needsOnboarding: !user.username,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/me/username
 *
 * Fija el username la PRIMERA vez. Idempotente para el caso del wizard
 * (el usuario puede cerrar y volver a abrir); el segundo intento con el
 * username ya puesto responde 409. Para cambios futuros habrá un endpoint
 * aparte con reglas distintas (cooldown, histórico, etc.).
 *
 * Validación con Zod — la invariante del modelo también valida, pero prefiero
 * rechazar en el borde con un mensaje claro antes de llegar a Mongoose, que
 * devuelve errores un poco crípticos.
 */
const usernameSchema = z.object({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_-]+$/, 'Solo letras minúsculas, números, guion y guion bajo'),
})

export async function setUsername(req, res, next) {
  const parsed = usernameSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Username inválido',
      issues: parsed.error.issues,
    })
  }
  const { username } = parsed.data

  if (RESERVED_USERNAMES.includes(username)) {
    return res.status(409).json({
      message: 'Ese nombre de usuario no está disponible',
    })
  }

  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    if (user.username) {
      return res.status(409).json({ message: 'Ya tienes un username asignado' })
    }

    user.username = username
    await user.save()

    return res.json({ username: user.username })
  } catch (err) {
    // E11000: dos usuarios distintos lo pidieron a la vez; el índice parcial
    // único es la última barrera. Mongoose propaga el error con code 11000.
    if (err?.code === 11000) {
      return res.status(409).json({
        message: 'Ese nombre de usuario ya está en uso',
      })
    }
    next(err)
  }
}
