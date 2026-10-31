import mongoose from 'mongoose'
import { z } from 'zod'
import Routine from '../models/routine.model.js'

/**
 * ObjectId "tipo string" en los endpoints.
 *
 * Mongoose auto-castea string -> ObjectId en find/update/create, así que no
 * hace falta `new mongoose.Types.ObjectId(...)` por todas partes. El regex
 * valida la forma antes de llegar a la base: así un id malformado devuelve
 * 400/404 limpio y no un cast error 500.
 */
const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId inválido')

/**
 * Un ejercicio dentro del body de create/update.
 *
 * Los targets son opcionales porque dependen del tipo de ejercicio: una cinta
 * no tiene `targetReps` ni `targetWeightKg`; un ejercicio de fuerza no tiene
 * `targetDurationSec`. El modelo lo deja ya como opcional; Zod se limita a
 * validar los rangos razonables.
 */
const exerciseEntrySchema = z.object({
  exercise: objectIdSchema,
  order: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(20).optional(),
  targetReps: z.number().int().min(0).optional(),
  targetWeightKg: z.number().min(0).optional(),
  targetDurationSec: z.number().int().min(0).optional(),
  targetDistanceM: z.number().min(0).optional(),
  // Peso de la barra planificado para este ejercicio dentro de la rutina
  // (solo tiene sentido para barra olímpica, que varía por gimnasio). El
  // modelo lo acepta null = "usa el peso baked del ejercicio".
  barWeightKg: z.number().min(0).max(50).optional(),
  notes: z.string().trim().max(500).optional(),
})

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional(),
  exercises: z.array(exerciseEntrySchema).min(1, 'Al menos un ejercicio'),
})

/**
 * PATCH acepta un subset. Pedimos que el body traiga al menos un campo,
 * porque un PATCH vacío es casi siempre un error del cliente, no una
 * intención real.
 */
const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  exercises: z.array(exerciseEntrySchema).min(1).optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'El PATCH necesita al menos un campo',
})

// ---------------------------------------------------------------------------
// GET /api/routines  -> lista resumida de MIS rutinas
// ---------------------------------------------------------------------------

/**
 * Devuelve un "summary" por rutina (sin el array completo de ejercicios).
 * El motivo es evitar traer 20 kB por rutina solo para pintar una lista;
 * el detalle completo se pide con GET /:id cuando el usuario abre una rutina.
 *
 * Lo resuelve una aggregation pipeline en vez de un find + map en JS:
 *   - $size calcula el conteo en el servidor de Mongo.
 *   - $project nunca envía el array `exercises` por la red.
 *
 * Interview: "el `exerciseCount` lo calcula Mongo, no Node — no transporto
 * datos que no voy a usar."
 */
export async function listRoutines(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const result = await Routine.aggregate([
      { $match: { user: userId } },
      {
        $project: {
          name: 1,
          description: 1,
          isSystemTemplate: 1,
          timesUsed: 1,
          lastUsedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          exerciseCount: { $size: { $ifNull: ['$exercises', []] } },
        },
      },
      { $sort: { lastUsedAt: -1, createdAt: -1 } },
    ])
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/routines  -> crea una rutina del usuario
// ---------------------------------------------------------------------------

export async function createRoutine(req, res, next) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const routine = await Routine.create({
      ...parsed.data,
      // Fuerza el owner desde la sesión: nunca de req.body. Si lo leyéramos
      // del body, un cliente podría crear rutinas en nombre de otro user.
      user: req.user.id,
    })
    res.status(201).json(routine)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/routines/:id  -> detalle de UNA rutina, con ejercicios populados
// ---------------------------------------------------------------------------

export async function getRoutine(req, res, next) {
  // Si el id ni siquiera es un ObjectId válido, evitamos el cast error.
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Rutina no encontrada' })
  }
  try {
    const routine = await Routine.findOne({
      _id: req.params.id,
      // Doble filtro: id + user. Si el id existe pero es de otro usuario,
      // devolvemos 404 (no 403) a propósito: 403 confirmaría "existe pero no
      // es tuya". 404 no filtra información sobre la existencia del recurso.
      user: req.user.id,
    })
      .populate('exercises.exercise')
      .lean()

    if (!routine) {
      return res.status(404).json({ message: 'Rutina no encontrada' })
    }
    res.json(routine)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/routines/:id  -> actualiza campos sueltos
// ---------------------------------------------------------------------------

/**
 * Si viene `exercises`, se reemplaza el array ENTERO. Decidido así para
 * evitar el pozo de parchear subdocumentos por índice: reordenar + añadir +
 * borrar en un solo PATCH se vuelve ambiguo rapido. El cliente manda la
 * lista final; el servidor la guarda tal cual.
 */
export async function updateRoutine(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Rutina no encontrada' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: parsed.data },
      {
        new: true,
        // Clave: findOneAndUpdate NO corre validadores por defecto. Si no lo
        // activas, puedes meter `name: ""` o cualquier basura que el schema
        // rechazaría en .save(). Esto los corre.
        runValidators: true,
      },
    )
    if (!routine) {
      return res.status(404).json({ message: 'Rutina no encontrada' })
    }
    res.json(routine)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/routines/:id  -> hard delete
// ---------------------------------------------------------------------------

/**
 * Hard delete, no soft delete. ¿Por qué podemos permitírnoslo?
 * Porque las sesiones históricas no se rompen: `session.routineName` guarda
 * una COPIA congelada del nombre al crear la sesión. El historial sigue
 * leyéndose aunque la rutina haya desaparecido. Esta es la razón de ser
 * de esa denormalización, no un capricho.
 */
export async function deleteRoutine(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Rutina no encontrada' })
  }
  try {
    const deleted = await Routine.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Rutina no encontrada' })
    }
    // 204 = No Content. No devolvemos cuerpo porque el recurso ya no existe.
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
