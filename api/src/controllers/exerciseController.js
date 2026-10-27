import mongoose from 'mongoose'
import { z } from 'zod'
import Exercise from '../models/exercise.model.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
  CATEGORIES,
  TRACKING_TYPES,
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

// ---------------------------------------------------------------------------
// Custom: create / update / delete
// ---------------------------------------------------------------------------

/**
 * Genera un slug ASCII a partir de un nombre humano.
 *
 * No es un identificador público (no hay URL tipo /exercise/press-loco), es
 * un id interno + ayuda para debugging. Lo que importa es que sea estable
 * para un mismo nombre y que no rompa el índice único (slug, createdBy).
 */
function slugify(input) {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'exercise'
}

/**
 * Encuentra un slug libre dentro del ámbito del usuario.
 *
 * El usuario tiene libertad de crear 28 ejercicios con el mismo `name` visible
 * ("tengo 5 variantes de press loco"); el slug interno se desambigua con
 * sufijo numérico silencioso — el usuario nunca lo ve, pero el índice único
 * (slug, createdBy) sigue vivo y protegiéndonos de duplicados exactos a nivel
 * de datos.
 *
 * No hay condición de carrera realista: un usuario no envía dos POST a la
 * vez para crear dos ejercicios idénticos. Aun así, el índice único es la
 * última barrera: si por lo que sea dos requests chocan, Mongo rechaza una
 * con E11000 y el frontend reintentará.
 */
async function nextFreeSlug(base, userId) {
  const existing = await Exercise.find(
    { createdBy: userId, slug: new RegExp(`^${base}(-\\d+)?$`) },
    { slug: 1 },
  ).lean()
  if (existing.length === 0) return base

  const used = new Set(existing.map((e) => e.slug))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Nombre bilingüe: debe traer al menos un idioma. Si pide los dos, los dos
 * tienen que cumplir longitud; si pide solo uno, solo se valida ese.
 */
const localizedNameSchema = z.object({
  es: z.string().trim().min(1).max(60).optional(),
  en: z.string().trim().min(1).max(60).optional(),
}).refine(
  (v) => Boolean(v.es || v.en),
  { message: 'El ejercicio necesita nombre en al menos un idioma' },
)

const instructionsSchema = z.object({
  es: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  en: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
}).optional()

const createSchema = z.object({
  name: localizedNameSchema,
  muscle: z.enum(MUSCLES),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  category: z.enum(CATEGORIES).optional(),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(5).optional(),
  instructions: instructionsSchema,
  tracking: z.enum(TRACKING_TYPES),
  visibility: z.enum(['private', 'public']).optional(),
})

/**
 * PATCH: todo opcional pero al menos un campo. No permito tocar `createdBy`,
 * `slug`, `usesBar`, `defaultBarWeightKg`, `gifUrl` ni `copiesCount` desde
 * body — son derivados o mantenidos por el servidor.
 *
 * El `name` sí se puede editar, pero el `slug` NO se regenera: es un id
 * interno estable (si el frontend lo cachea en algún sitio, cambiarlo con
 * un rename sería un bug sutil). Si el usuario quiere un slug distinto,
 * crea un ejercicio nuevo.
 */
const updateSchema = z.object({
  name: localizedNameSchema.optional(),
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  category: z.enum(CATEGORIES).optional(),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(5).optional(),
  instructions: instructionsSchema,
  tracking: z.enum(TRACKING_TYPES).optional(),
  visibility: z.enum(['private', 'public']).optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: 'El PATCH necesita al menos un campo' },
)

export const createExercise = async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // Base del slug: preferimos el nombre español si existe, si no el inglés.
    const base = slugify(parsed.data.name.es || parsed.data.name.en)
    const slug = await nextFreeSlug(base, req.user.id)

    const exercise = await Exercise.create({
      ...parsed.data,
      slug,
      createdBy: req.user.id,  // forzado desde sesión, nunca del body
    })
    res.status(201).json(exercise)
  } catch (err) {
    // E11000 = carrera perdida contra el índice único (slug, createdBy).
    // Devolver 409 para que el cliente reintente; es más honesto que un 500.
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Colisión de slug, reintenta' })
    }
    next(err)
  }
}

export const updateExercise = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // Doble filtro: id + propietario. Un ejercicio del catálogo global
    // (createdBy: null) nunca entrará aquí porque req.user.id != null.
    // 404 si no existe O si existe y no es del usuario — misma razón que
    // en routines, no leak de ids ajenos.
    const exercise = await Exercise.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      { $set: parsed.data },
      {
        new: true,
        runValidators: true,
      },
    )
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (err) {
    next(err)
  }
}

export const deleteExercise = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const deleted = await Exercise.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,  // bloquea borrar el catálogo global y ajenos
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    // Hard delete seguro: las sesiones pasadas guardan `entries[].exerciseName`
    // y `muscle` denormalizados, así que el historial sobrevive al borrado
    // del documento original. Mismo contrato que en routines.
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
