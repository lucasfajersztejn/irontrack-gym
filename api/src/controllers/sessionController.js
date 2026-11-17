import mongoose from 'mongoose'
import { z } from 'zod'
import Session from '../models/session.model.js'
import Routine from '../models/routine.model.js'
import { MUSCLES, TRACKING_TYPES, MAX_SESSION_HOURS } from '../models/constants.js'
import { evaluateAndPersist } from '../lib/badgeEngine.js'

/** Zod schemas */
const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId inválido')

const setSchema = z.object({
  order: z.number().int().min(0),
  weightKg: z.number().min(0).optional(),
  reps: z.number().int().min(0).optional(),
  addedWeightKg: z.number().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
  distanceM: z.number().min(0).optional(),
  rir: z.number().int().min(0).max(5).optional(),
  completed: z.boolean().optional(),
  restSec: z.number().int().min(0).optional(),
})

const entrySchema = z.object({
  exercise: objectIdSchema,
  exerciseName: z.string().trim().min(1).max(100),
  muscle: z.enum(MUSCLES),
  tracking: z.enum(TRACKING_TYPES),
  order: z.number().int().min(0),
  groupId: z.string().trim().max(64).nullable().optional(),
  barWeightKg: z.number().min(0).max(50).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  sets: z.array(setSchema).default([]),
})

const createSchema = z.object({
  routine: objectIdSchema.nullable().optional(),
  startedAt: z.coerce.date().optional(),
  timeZone: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(1000).optional(),
})

function isValidTimeZone(tz) {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

const updateSchema = z.object({
  entries: z.array(entrySchema).optional(),
  notes: z.string().trim().max(1000).optional(),
  startedAt: z.coerce.date().optional(),
  endedAt: z.coerce.date().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'El PATCH necesita al menos un campo',
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  routine: objectIdSchema.optional(),
  detail: z.literal('1').optional(),
})

// Per-entry breakdown weekly stats needs, resolving secondaryMuscles from a single $lookup.
const detailEntriesProjection = {
  $map: {
    input: { $ifNull: ['$entries', []] },
    as: 'e',
    in: {
      exerciseName: '$$e.exerciseName',
      muscle: '$$e.muscle',
      tracking: '$$e.tracking',
      exercise: {
        _id: '$$e.exercise',
        secondaryMuscles: {
          $let: {
            vars: {
              ex: {
                $first: {
                  $filter: {
                    input: '$_exDocs',
                    as: 'x',
                    cond: { $eq: ['$$x._id', '$$e.exercise'] },
                  },
                },
              },
            },
            in: { $ifNull: ['$$ex.secondaryMuscles', []] },
          },
        },
      },
      sets: {
        $map: {
          input: { $ifNull: ['$$e.sets', []] },
          as: 's',
          in: {
            completed: '$$s.completed',
            weightKg: '$$s.weightKg',
            reps: '$$s.reps',
            durationSec: '$$s.durationSec',
            distanceM: '$$s.distanceM',
          },
        },
      },
    },
  },
}

const heatmapQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
}).refine(
  (v) => (v.to - v.from) <= 1000 * 60 * 60 * 24 * 430,
  { message: 'Rango máximo de 430 días' },
).refine((v) => v.to >= v.from, { message: 'to debe ser >= from' })

// GET /api/sessions: paginated history without entries

export async function listSessions(req, res, next) {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const { page, limit, from, to, routine, detail } = parsed.data
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const match = { user: userId }
    if (from || to) {
      match.startedAt = {}
      if (from) match.startedAt.$gte = from
      if (to) match.startedAt.$lte = to
    }
    if (routine) match.routine = new mongoose.Types.ObjectId(routine)

    const projection = {
      routine: 1,
      routineName: 1,
      startedAt: 1,
      endedAt: 1,
      durationEstimated: 1,
      notes: 1,
      createdAt: 1,
      updatedAt: 1,
      entryCount: { $size: { $ifNull: ['$entries', []] } },
      setCount: {
        $sum: {
          $map: {
            input: { $ifNull: ['$entries', []] },
            as: 'e',
            in: { $size: { $ifNull: ['$$e.sets', []] } },
          },
        },
      },
      durationSec: {
        $cond: [
          { $ifNull: ['$endedAt', false] },
          {
            $round: [
              { $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 1000] },
            ],
          },
          null,
        ],
      },
    }

    const pipeline = [
      { $match: match },
      { $sort: { startedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]

    if (detail) {
      pipeline.push({
        $lookup: {
          from: 'exercises',
          localField: 'entries.exercise',
          foreignField: '_id',
          as: '_exDocs',
          pipeline: [{ $project: { secondaryMuscles: 1 } }],
        },
      })
      projection.entries = detailEntriesProjection
    }

    pipeline.push({ $project: projection })

    const result = await Session.aggregate(pipeline)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// GET /api/sessions/heatmap: per-session intensity in a range

export async function getHeatmap(req, res, next) {
  const parsed = heatmapQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const { from, to } = parsed.data
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const result = await Session.aggregate([
      { $match: { user: userId, startedAt: { $gte: from, $lte: to } } },
      { $unwind: { path: '$entries', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$entries.sets', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _isStrength: {
            $in: ['$entries.tracking', ['weight_reps', 'reps']],
          },
          _isCardio: {
            $in: ['$entries.tracking', ['time', 'distance_time']],
          },
        },
      },
      {
        $addFields: {
          _setWeight: {
            $cond: [
              { $and: ['$_isStrength', { $ne: ['$entries.sets.rir', null] }] },
              {
                $cond: [
                  { $eq: ['$entries.tracking', 'weight_reps'] },
                  {
                    $cond: [
                      { $gt: [{ $ifNull: ['$entries.sets.weightKg', 0] }, 0] },
                      {
                        $multiply: [
                          '$entries.sets.weightKg',
                          { $ifNull: ['$entries.sets.reps', 0] },
                        ],
                      },
                      { $ifNull: ['$entries.sets.reps', 0] },
                    ],
                  },
                  { $ifNull: ['$entries.sets.reps', 0] },
                ],
              },
              0,
            ],
          },
          _setEffort: {
            $cond: [
              { $and: ['$_isStrength', { $ne: ['$entries.sets.rir', null] }] },
              { $divide: [{ $subtract: [5, '$entries.sets.rir'] }, 5] },
              0,
            ],
          },
          _cardioSec: {
            $cond: [
              '$_isCardio',
              { $ifNull: ['$entries.sets.durationSec', 0] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$_id',
          startedAt: { $first: '$startedAt' },
          strengthEffortSum: {
            $sum: { $multiply: ['$_setEffort', '$_setWeight'] },
          },
          strengthWeight: { $sum: '$_setWeight' },
          cardioSeconds: { $sum: '$_cardioSec' },
        },
      },
      {
        $project: {
          _id: 0,
          startedAt: 1,
          intensity: {
            $let: {
              vars: {
                strengthEffort: {
                  $cond: [
                    { $gt: ['$strengthWeight', 0] },
                    { $divide: ['$strengthEffortSum', '$strengthWeight'] },
                    null,
                  ],
                },
                cardioMinutes: { $divide: ['$cardioSeconds', 60] },
              },
              in: {
                $let: {
                  vars: {
                    cardioEffort: {
                      $switch: {
                        branches: [
                          { case: { $eq: ['$$cardioMinutes', 0] }, then: null },
                          { case: { $lt: ['$$cardioMinutes', 20] }, then: 0.25 },
                          { case: { $lt: ['$$cardioMinutes', 40] }, then: 0.50 },
                          { case: { $lt: ['$$cardioMinutes', 60] }, then: 0.75 },
                        ],
                        default: 1.0,
                      },
                    },
                  },
                  in: {
                    $cond: [
                      { $and: [
                        { $ne: ['$$strengthEffort', null] },
                        { $ne: ['$$cardioEffort', null] },
                      ] },
                      { $max: ['$$strengthEffort', '$$cardioEffort'] },
                      { $ifNull: ['$$strengthEffort', '$$cardioEffort'] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { startedAt: 1 } },
    ])
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// Skip routine entries whose exercise was deleted (populates to null).
const liveRoutineExercises = (routine) => routine.exercises.filter((re) => re.exercise)

function plansFromRoutine(routine) {
  if (!routine) return null
  return new Map(
    liveRoutineExercises(routine).map((re) => [
      re.exercise._id.toString(),
      {
        targetSets: re.targetSets ?? 0,
        targetReps: re.targetReps ?? null,
        targetWeightKg: re.targetWeightKg ?? null,
        targetDurationSec: re.targetDurationSec ?? null,
        targetDistanceM: re.targetDistanceM ?? null,
      },
    ]),
  )
}

function withPlannedSets(session, routinePlans) {
  const payload = session.toObject({ virtuals: true })
  if (!routinePlans) return payload
  payload.entries = payload.entries.map((e) => {
    const plan = routinePlans.get((e.exercise?._id ?? e.exercise).toString())
    if (!plan || !plan.targetSets) return e
    const plannedSets = Array.from({ length: plan.targetSets }, (_, i) => ({
      order: i,
      weightKg: plan.targetWeightKg,
      reps: plan.targetReps,
      durationSec: plan.targetDurationSec,
      distanceM: plan.targetDistanceM,
    }))
    return { ...e, plannedSets }
  })
  return payload
}

// GET /api/sessions/active: the user's open session, or null

export async function getActiveSession(req, res, next) {
  try {
    const session = await Session.findOne({
      user: req.user.id,
      endedAt: null,
    }).populate('entries.exercise')
    if (!session) return res.json(null)

    const routine = session.routine
      ? await Routine.findOne({
          _id: session.routine,
          user: req.user.id,
        }).populate('exercises.exercise')
      : null
    res.json(withPlannedSets(session, plansFromRoutine(routine)))
  } catch (err) {
    next(err)
  }
}

// GET /api/sessions/:id: detail

export async function getSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate('entries.exercise')
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }
    res.json(session)
  } catch (err) {
    next(err)
  }
}

// POST /api/sessions: start a session

export async function createSession(req, res, next) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const active = await Session.findOne({
      user: req.user.id,
      endedAt: null,
    }).select('_id')
    if (active) {
      return res.status(409).json({
        message: 'Ya tienes una sesión activa',
        activeId: active._id,
      })
    }

    const doc = {
      user: req.user.id,
      startedAt: parsed.data.startedAt || new Date(),
      timeZone: isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : null,
      notes: parsed.data.notes,
      entries: [],
      routine: null,
      routineName: null,
    }

    let routinePlans = plansFromRoutine(null)

    if (parsed.data.routine) {
      const routine = await Routine.findOne({
        _id: parsed.data.routine,
        user: req.user.id,
      }).populate('exercises.exercise')
      if (!routine) {
        return res.status(404).json({ message: 'Rutina no encontrada' })
      }

      doc.routine = routine._id
      doc.routineName = routine.name
      routinePlans = plansFromRoutine(routine)
      doc.entries = liveRoutineExercises(routine).map((re) => ({
        exercise: re.exercise._id,
        exerciseName: re.exercise.name?.es || re.exercise.name?.en || 'Ejercicio',
        muscle: re.exercise.muscle,
        tracking: re.exercise.tracking,
        order: re.order,
        groupId: re.groupId ?? null,
        barWeightKg: re.barWeightKg ?? null,
        notes: re.notes,
        sets: [],
      }))
    }

    const session = await Session.create(doc)
    await session.populate('entries.exercise')

    res.status(201).json(withPlannedSets(session, routinePlans))
  } catch (err) {
    next(err)
  }
}

// PATCH /api/sessions/:id: edit fields

export async function updateSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }

    const data = parsed.data
    if (data.entries !== undefined) session.entries = data.entries
    if (data.notes !== undefined) session.notes = data.notes
    if (data.startedAt !== undefined) session.startedAt = data.startedAt
    if (Object.prototype.hasOwnProperty.call(data, 'endedAt')) {
      session.endedAt = data.endedAt
      session.durationEstimated = false
    }

    await session.save()
    res.json(session)
  } catch (err) {
    if (err?.name === 'ValidationError' || err?.name === 'Error') {
      return res.status(400).json({ message: err.message })
    }
    next(err)
  }
}

// POST /api/sessions/:id/finish: close a session

export async function finishSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }

    if (session.endedAt) {
      return res.json(session)
    }

    session.endedAt = new Date()
    await session.save()

    if (session.routine) {
      await Routine.updateOne(
        { _id: session.routine, user: req.user.id },
        {
          $inc: { timesUsed: 1 },
          $set: { lastUsedAt: session.endedAt },
        },
      )
    }

    try {
      await evaluateAndPersist(req.user.id)
    } catch (err) {
      console.error('[badges] evaluación tras finish falló:', err?.message)
    }

    res.json(session)
  } catch (err) {
    if (err?.name === 'ValidationError' || err?.name === 'Error') {
      return res.status(400).json({ message: err.message })
    }
    next(err)
  }
}

// DELETE /api/sessions/:id: hard delete

// POST /api/sessions/sweep: close orphaned sessions (admin)

export async function sweepSessions(req, res, next) {
  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() - MAX_SESSION_HOURS * 3600 * 1000)

    const result = await Session.updateMany(
      { endedAt: null, startedAt: { $lt: cutoff } },
      [
        {
          $set: {
            endedAt: {
              $add: ['$startedAt', MAX_SESSION_HOURS * 3600 * 1000],
            },
            durationEstimated: true,
          },
        },
      ],
    )

    res.json({
      closed: result.modifiedCount,
      cutoff,
    })
  } catch (err) {
    next(err)
  }
}

export async function deleteSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    const deleted = await Session.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
