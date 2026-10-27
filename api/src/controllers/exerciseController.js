import mongoose from 'mongoose'
import { z } from 'zod'
import Exercise from '../models/exercise.model.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
} from '../models/constants.js'

/**
 * Visibilidad: el usuario ve el catálogo global (createdBy: null) MÁS sus
 * ejercicios custom (createdBy === su id). Nunca los custom de otros.
 *
 * Lo expresa un $or con dos ramas sobre el mismo campo `createdBy`, que ya
 * está indexado en el modelo. Es una sola consulta, no dos finds unidos
 * en memoria.
 *
 * `mine=1` restringe a solo los custom del usuario, útil para la pantalla
 * "mis ejercicios".
 */
function visibilityFilter(userId, mineOnly) {
  if (mineOnly) return { createdBy: userId }
  return { $or: [{ createdBy: null }, { createdBy: userId }] }
}

const listQuerySchema = z.object({
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  // "1" lo manda el frontend como string; z.coerce.boolean no sirve bien aquí
  // porque "0" también se castea a true. Comparo explícito.
  mine: z.enum(['0', '1']).optional(),
})

export const getExercises = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }

  const { muscle, bodyPart, equipment, search, mine } = parsed.data
  const filter = visibilityFilter(req.user.id, mine === '1')
  if (muscle) filter.muscle = muscle
  if (bodyPart) filter.bodyPart = bodyPart
  if (equipment) filter.equipment = equipment
  // Usa el índice de texto bilingüe del modelo en vez de $regex sobre un subdoc.
  if (search) filter.$text = { $search: search }

  try {
    const exercises = await Exercise.find(filter)
      .sort({ 'name.es': 1 })
      .limit(200)
    res.json(exercises)
  } catch (err) {
    next(err)
  }
}

export const getBodyParts = async (req, res, next) => {
  try {
    const bodyParts = await Exercise.distinct(
      'bodyPart',
      visibilityFilter(req.user.id, false),
    )
    res.json(bodyParts.sort())
  } catch (err) {
    next(err)
  }
}

export const getMuscles = async (req, res, next) => {
  try {
    const muscles = await Exercise.distinct(
      'muscle',
      visibilityFilter(req.user.id, false),
    )
    res.json(muscles.sort())
  } catch (err) {
    next(err)
  }
}

export const getExerciseById = async (req, res, next) => {
  // Mismo patrón que en routines: si el id no es un ObjectId válido, 404
  // directo sin tocar la base. Evita un CastError 500 que no aporta nada.
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      ...visibilityFilter(req.user.id, false),
    })
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (err) {
    next(err)
  }
}
