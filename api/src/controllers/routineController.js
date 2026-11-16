import mongoose from 'mongoose'
import { z } from 'zod'
import Routine from '../models/routine.model.js'

const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId inválido')

const exerciseEntrySchema = z.object({
  exercise: objectIdSchema,
  order: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(20).optional(),
  targetReps: z.number().int().min(0).optional(),
  targetWeightKg: z.number().min(0).optional(),
  targetDurationSec: z.number().int().min(0).optional(),
  targetDistanceM: z.number().min(0).optional(),
  barWeightKg: z.number().min(0).max(50).optional(),
  groupId: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
})

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).optional(),
  exercises: z.array(exerciseEntrySchema).min(1, 'Al menos un ejercicio'),
})

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(500).optional(),
  exercises: z.array(exerciseEntrySchema).min(1).optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'El PATCH necesita al menos un campo',
})

// GET /api/routines: summary list of my routines

export async function listRoutines(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const result = await Routine.aggregate([
      { $match: { user: userId } },
      {
        $lookup: {
          from: 'exercises',
          localField: 'exercises.exercise',
          foreignField: '_id',
          as: 'exerciseDocs',
          pipeline: [{ $project: { muscle: 1 } }],
        },
      },
      {
        $addFields: {
          muscles: { $setUnion: ['$exerciseDocs.muscle', []] },
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          isSystemTemplate: 1,
          timesUsed: 1,
          lastUsedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          muscles: 1,
          exerciseCount: { $size: { $ifNull: ['$exercises', []] } },
        },
      },
      { $sort: { order: 1, createdAt: 1 } },
    ])
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// POST /api/routines: create a routine

export async function createRoutine(req, res, next) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const last = await Routine.findOne({ user: req.user.id })
      .sort({ order: -1 })
      .select('order')
      .lean()
    const nextOrder = (last?.order ?? -1) + 1

    const routine = await Routine.create({
      ...parsed.data,
      user: req.user.id,
      order: nextOrder,
    })
    res.status(201).json(routine)
  } catch (err) {
    next(err)
  }
}

// PATCH /api/routines/reorder: reorder routines

const reorderSchema = z.object({
  ids: z
    .array(objectIdSchema)
    .min(1, 'Al menos una rutina')
    .max(200, 'Demasiadas rutinas'),
})

export async function reorderRoutines(req, res, next) {
  const parsed = reorderSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  const { ids } = parsed.data

  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ message: 'IDs duplicados' })
  }

  try {
    const owned = await Routine.find({
      _id: { $in: ids },
      user: req.user.id,
    })
      .select('_id')
      .lean()

    if (owned.length !== ids.length) {
      return res.status(403).json({ message: 'IDs no pertenecen al usuario' })
    }

    await Routine.bulkWrite(
      ids.map((id, index) => ({
        updateOne: {
          filter: { _id: id, user: req.user.id },
          update: { $set: { order: index } },
        },
      })),
    )

    res.status(204).send()
  } catch (err) {
    next(err)
  }
}

// GET /api/routines/:id: one routine with populated exercises

export async function getRoutine(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Rutina no encontrada' })
  }
  try {
    const routine = await Routine.findOne({
      _id: req.params.id,
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

// PATCH /api/routines/:id: update fields

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

// DELETE /api/routines/:id: hard delete

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
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
