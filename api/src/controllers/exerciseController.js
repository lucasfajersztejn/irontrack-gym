import { z } from 'zod'
import Exercise from '../models/exercise.model.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
} from '../models/constants.js'

// Fase 1: catálogo público (createdBy: null). Los ejercicios custom se filtrarán
// por propietario cuando Better Auth y req.user estén montados.
const CATALOG_ONLY = { createdBy: null }

const listQuerySchema = z.object({
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  search: z.string().trim().min(1).max(80).optional(),
})

export const getExercises = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }

  const { muscle, bodyPart, equipment, search } = parsed.data
  const filter = { ...CATALOG_ONLY }
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
    const bodyParts = await Exercise.distinct('bodyPart', CATALOG_ONLY)
    res.json(bodyParts.sort())
  } catch (err) {
    next(err)
  }
}

export const getMuscles = async (req, res, next) => {
  try {
    const muscles = await Exercise.distinct('muscle', CATALOG_ONLY)
    res.json(muscles.sort())
  } catch (err) {
    next(err)
  }
}

export const getExerciseById = async (req, res, next) => {
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      ...CATALOG_ONLY,
    })
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (err) {
    next(err)
  }
}
