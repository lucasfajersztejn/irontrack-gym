import mongoose from 'mongoose'
import { z } from 'zod'
import User from '../models/user.model.js'
import Exercise from '../models/exercise.model.js'
import {
  RESERVED_USERNAMES,
  LOCALES,
  BAR_INPUT_MODES,
} from '../models/constants.js'

/** GET /api/me: authenticated profile plus needsOnboarding */
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
      exerciseAliases: user.exerciseAliases ?? {},

      needsOnboarding: !user.username,
    })
  } catch (err) {
    next(err)
  }
}

const usernameSchema = z.object({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(20)
    .regex(/^[a-z0-9_-]+$/, 'Solo letras minúsculas, números, guion y guion bajo'),
})

const settingsSchema = z.object({
  locale: z.enum(LOCALES).optional(),
  barInputMode: z.enum(BAR_INPUT_MODES).optional(),
  defaultBarWeightKg: z.number().min(0).max(50).optional(),
  restTimerSec: z.number().int().min(0).max(600).optional(),
  weeklyGoal: z.number().int().min(1).max(14).optional(),
  suggestProgression: z.boolean().optional(),
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

/** PUT/DELETE /api/me/favorites/:exerciseId: toggle a favorite */
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

const aliasBodySchema = z.object({
  name: z.string().trim().min(1).max(40),
})

export async function setAlias(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.exerciseId)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  const parsed = aliasBodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Nombre inválido',
      issues: parsed.error.issues,
    })
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
      { $set: { [`exerciseAliases.${exercise._id}`]: parsed.data.name } },
      { new: true, runValidators: true },
    ).select('exerciseAliases')
    res.json({ exerciseAliases: user.exerciseAliases })
  } catch (err) {
    next(err)
  }
}

export async function removeAlias(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.exerciseId)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { [`exerciseAliases.${req.params.exerciseId}`]: '' } },
      { new: true },
    ).select('exerciseAliases')
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    res.json({ exerciseAliases: user.exerciseAliases })
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
    if (err?.code === 11000) {
      return res.status(409).json({
        message: 'Ese nombre de usuario ya está en uso',
      })
    }
    next(err)
  }
}
