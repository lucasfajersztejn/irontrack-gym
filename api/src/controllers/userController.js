import mongoose from 'mongoose'
import { z } from 'zod'
import User from '../models/user.model.js'
import Exercise from '../models/exercise.model.js'
import {
  RESERVED_USERNAMES,
  LOCALES,
  UNIT_SYSTEMS,
  BAR_INPUT_MODES,
} from '../models/constants.js'

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
      favoriteExercises: user.favoriteExercises ?? [],

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

/**
 * PATCH /api/me/settings
 *
 * Actualiza un subset de preferencias del usuario. Todo opcional, pero al
 * menos un campo. Validamos aquí (Zod) y confiamos en el schema de Mongoose
 * para la cerrada en rango (el modelo ya tiene min/max). Si en el futuro
 * añadimos settings más complejos (notificaciones, privacy avanzada), este
 * endpoint se convierte en el único canal y evitamos n endpoints paralelos.
 *
 * Los campos no listados aquí quedan intactos: `$set` solo toca los que
 * recibimos.
 */
const settingsSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  units: z.enum(UNIT_SYSTEMS).optional(),
  barInputMode: z.enum(BAR_INPUT_MODES).optional(),
  defaultBarWeightKg: z.number().min(0).max(50).optional(),
  restTimerSec: z.number().int().min(0).max(600).optional(),
  weeklyGoal: z.number().int().min(1).max(14).optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'Al menos un campo',
})

export async function updateSettings(req, res, next) {
  const parsed = settingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // $set con notación dot: evita pisar los otros campos de `settings` por
    // mandarlo entero. Si pasamos { settings: { weeklyGoal: 5 } }, Mongo
    // reemplaza TODO el subdoc y perderíamos locale, units, etc.
    const update = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      update[`settings.${k}`] = v
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true },
    )
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    res.json({ settings: user.settings })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/me/favorites/:exerciseId
 * DELETE /api/me/favorites/:exerciseId
 *
 * Toggle de favoritos atómico: $addToSet / $pull sobre `favoriteExercises`.
 * Antes de añadir validamos que el ejercicio es VISIBLE para el usuario (del
 * catálogo global o propio custom); si no, 404 — así no se puede favoritear
 * un custom ajeno guessing el ObjectId.
 */
export async function addFavorite(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.exerciseId)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.exerciseId,
      $or: [{ createdBy: null }, { createdBy: req.user.id }],
    }).select('_id')
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { favoriteExercises: exercise._id } },
      { new: true },
    ).select('favoriteExercises')
    res.json({ favoriteExercises: user.favoriteExercises })
  } catch (err) {
    next(err)
  }
}

export async function removeFavorite(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.exerciseId)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { favoriteExercises: req.params.exerciseId } },
      { new: true },
    ).select('favoriteExercises')
    res.json({ favoriteExercises: user.favoriteExercises })
  } catch (err) {
    next(err)
  }
}

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
