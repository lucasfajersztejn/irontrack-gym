import mongoose from 'mongoose'
import { z } from 'zod'
import Exercise from '../models/exercise.model.js'
import Session from '../models/session.model.js'
import Routine from '../models/routine.model.js'
import User from '../models/user.model.js'
import { attachExerciseNames } from '../lib/exerciseNames.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
  CATEGORIES,
  TRACKING_TYPES,
} from '../models/constants.js'

function visibilityFilter(userId, mineOnly) {
  if (mineOnly) return { createdBy: userId }
  return { $or: [{ createdBy: null }, { createdBy: userId }] }
}

const listQuerySchema = z.object({
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  mine: z.enum(['0', '1']).optional(),
  favorites: z.enum(['0', '1']).optional(),
})

export const getExercises = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }

  const { muscle, bodyPart, equipment, search, mine, favorites } = parsed.data
  const filter = visibilityFilter(req.user.id, mine === '1')
  if (muscle) filter.muscle = muscle
  if (bodyPart) filter.bodyPart = bodyPart
  if (equipment) filter.equipment = equipment
  if (search) filter.$text = { $search: search }

  try {
    if (favorites === '1') {
      const user = await User.findById(req.user.id).select('favoriteExercises').lean()
      const ids = user?.favoriteExercises ?? []
      if (ids.length === 0) {
        return res.json([])
      }
      filter._id = { $in: ids }
    }

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

// Custom exercises: create / update / delete

function slugify(input) {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'exercise'
}

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
    const base = slugify(parsed.data.name.es || parsed.data.name.en)
    const slug = await nextFreeSlug(base, req.user.id)

    const exercise = await Exercise.create({
      ...parsed.data,
      slug,
      createdBy: req.user.id,
    })
    res.status(201).json(exercise)
  } catch (err) {
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

// GET /api/exercises/history?ids=<a>,<b>: prefill + PRs for the live session

const historyQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .refine((arr) => arr.length <= 40, {
      message: 'Máximo 40 ejercicios por llamada',
    })
    .refine((arr) => arr.every((id) => /^[a-f0-9]{24}$/i.test(id)), {
      message: 'ids contiene un ObjectId inválido',
    }),
})

export const getExercisesHistory = async (req, res, next) => {
  const parsed = historyQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const ids = parsed.data.ids.map((id) => new mongoose.Types.ObjectId(id))

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const [prRows, lastRows] = await Promise.all([
      Session.aggregate([
        { $match: { user: userId, 'entries.exercise': { $in: ids } } },
        { $unwind: '$entries' },
        { $match: { 'entries.exercise': { $in: ids } } },
        { $unwind: '$entries.sets' },
        { $match: { 'entries.sets.completed': true } },
        {
          $group: {
            _id: '$entries.exercise',
            heaviestKg: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'weight_reps'] },
                  '$entries.sets.weightKg',
                  null,
                ],
              },
            },
            best1RM: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$entries.tracking', 'weight_reps'] },
                      { $gt: ['$entries.sets.weightKg', 0] },
                      { $gt: ['$entries.sets.reps', 0] },
                    ],
                  },
                  {
                    $multiply: [
                      '$entries.sets.weightKg',
                      { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
                    ],
                  },
                  null,
                ],
              },
            },
            bestReps: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'reps'] },
                  '$entries.sets.reps',
                  null,
                ],
              },
            },
          },
        },
      ]),
      Session.aggregate([
        {
          $match: {
            user: userId,
            endedAt: { $ne: null },
            'entries.exercise': { $in: ids },
          },
        },
        { $sort: { startedAt: -1 } },
        { $unwind: '$entries' },
        {
          $match: {
            'entries.exercise': { $in: ids },
            'entries.sets.0': { $exists: true },
          },
        },
        {
          $group: {
            _id: '$entries.exercise',
            startedAt: { $first: '$startedAt' },
            sets: { $first: '$entries.sets' },
          },
        },
      ]),
    ])

    const byId = {}
    for (const row of lastRows) {
      byId[row._id.toString()] = {
        lastSession: {
          startedAt: row.startedAt,
          sets: (row.sets ?? []).map((s) => ({
            order: s.order,
            weightKg: s.weightKg ?? null,
            reps: s.reps ?? null,
            addedWeightKg: s.addedWeightKg ?? null,
            durationSec: s.durationSec ?? null,
            distanceM: s.distanceM ?? null,
            rir: s.rir ?? null,
          })),
        },
        prs: { heaviestKg: null, best1RM: null, bestReps: null },
      }
    }
    for (const row of prRows) {
      const key = row._id.toString()
      if (!byId[key]) {
        byId[key] = {
          lastSession: null,
          prs: { heaviestKg: null, best1RM: null, bestReps: null },
        }
      }
      byId[key].prs = {
        heaviestKg: row.heaviestKg ?? null,
        best1RM: row.best1RM != null
          ? Math.round(row.best1RM * 10) / 10
          : null,
        bestReps: row.bestReps ?? null,
      }
    }

    for (const id of parsed.data.ids) {
      if (!byId[id]) {
        byId[id] = {
          lastSession: null,
          prs: { heaviestKg: null, best1RM: null, bestReps: null },
        }
      }
    }

    res.json(byId)
  } catch (err) {
    next(err)
  }
}

// GET /api/exercises/:id/progress: per-session weight and 1RM curve

export const getExerciseProgress = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const exerciseObjectId = new mongoose.Types.ObjectId(req.params.id)

    const exercise = await Exercise.findOne({
      _id: exerciseObjectId,
      ...visibilityFilter(req.user.id, false),
    }).select('_id').lean()
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }

    const rows = await Session.aggregate([
      { $match: { user: userId, 'entries.exercise': exerciseObjectId } },
      { $unwind: '$entries' },
      {
        $match: {
          'entries.exercise': exerciseObjectId,
          'entries.tracking': 'weight_reps',
        },
      },
      { $unwind: '$entries.sets' },
      {
        $match: {
          'entries.sets.completed': true,
          'entries.sets.weightKg': { $gt: 0 },
          'entries.sets.reps': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$_id',
          startedAt: { $first: '$startedAt' },
          heaviestKg: { $max: '$entries.sets.weightKg' },
          best1RM: {
            $max: {
              $multiply: [
                '$entries.sets.weightKg',
                { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
              ],
            },
          },
        },
      },
      { $sort: { startedAt: 1 } },
    ])

    const points = rows.map((row) => ({
      sessionId: row._id.toString(),
      date: row.startedAt,
      heaviestKg: row.heaviestKg,
      best1RM: Math.round(row.best1RM * 10) / 10,
    }))

    res.json({ exerciseId: req.params.id, points })
  } catch (err) {
    next(err)
  }
}

// GET /api/exercises/recent-prs?sinceDays=30: PRs from the last month

const recentPrsQuerySchema = z.object({
  sinceDays: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v == null ? 30 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1 && n <= 365, {
      message: 'sinceDays debe estar entre 1 y 365',
    }),
})

export const getRecentPrs = async (req, res, next) => {
  const parsed = recentPrsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const sinceDays = parsed.data.sinceDays
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const [preRows, windowSessions] = await Promise.all([
      Session.aggregate([
        { $match: { user: userId, startedAt: { $lt: cutoff } } },
        { $unwind: '$entries' },
        { $unwind: '$entries.sets' },
        { $match: { 'entries.sets.completed': true } },
        {
          $group: {
            _id: '$entries.exercise',
            heaviestKg: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'weight_reps'] },
                  '$entries.sets.weightKg',
                  null,
                ],
              },
            },
            best1RM: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$entries.tracking', 'weight_reps'] },
                      { $gt: ['$entries.sets.weightKg', 0] },
                      { $gt: ['$entries.sets.reps', 0] },
                    ],
                  },
                  {
                    $multiply: [
                      '$entries.sets.weightKg',
                      { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
                    ],
                  },
                  null,
                ],
              },
            },
            bestReps: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'reps'] },
                  '$entries.sets.reps',
                  null,
                ],
              },
            },
          },
        },
      ]),
      Session.find({ user: userId, startedAt: { $gte: cutoff } })
        .select('startedAt entries.exercise entries.exerciseName entries.tracking entries.sets')
        .sort({ startedAt: 1 })
        .lean(),
    ])

    const baseline = new Map()
    for (const row of preRows) {
      baseline.set(row._id.toString(), {
        heaviestKg: row.heaviestKg ?? 0,
        best1RM: row.best1RM ?? 0,
        bestReps: row.bestReps ?? 0,
      })
    }

    const prs = []
    for (const session of windowSessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps' && entry.tracking !== 'reps') continue
        const exId = entry.exercise.toString()
        const base = baseline.get(exId) ?? {
          heaviestKg: 0,
          best1RM: 0,
          bestReps: 0,
        }

        for (const set of entry.sets ?? []) {
          if (!set.completed) continue

          if (entry.tracking === 'weight_reps') {
            const w = set.weightKg ?? 0
            const r = set.reps ?? 0

            if (w > base.heaviestKg) {
              prs.push({
                exerciseId: exId,
                exerciseName: entry.exerciseName ?? null,
                kind: 'heaviest',
                value: w,
                prevValue: base.heaviestKg || null,
                achievedAt: session.startedAt,
              })
              base.heaviestKg = w
            }

            if (w > 0 && r > 0) {
              const e1rm = Math.round(w * (1 + r / 30) * 10) / 10
              if (e1rm > base.best1RM) {
                prs.push({
                  exerciseId: exId,
                  exerciseName: entry.exerciseName ?? null,
                  kind: '1rm',
                  value: e1rm,
                  prevValue: base.best1RM || null,
                  achievedAt: session.startedAt,
                })
                base.best1RM = e1rm
              }
            }
          } else if (entry.tracking === 'reps') {
            const r = set.reps ?? 0
            if (r > base.bestReps) {
              prs.push({
                exerciseId: exId,
                exerciseName: entry.exerciseName ?? null,
                kind: 'reps',
                value: r,
                prevValue: base.bestReps || null,
                achievedAt: session.startedAt,
              })
              base.bestReps = r
            }
          }
        }

        baseline.set(exId, base)
      }
    }

    prs.sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt))

    await attachExerciseNames(prs)

    res.json({ sinceDays, prs })
  } catch (err) {
    next(err)
  }
}

// GET /api/exercises/stalled: exercises with no recent improvement

const STALL_MIN_SESSIONS_SINCE_PR = 6
const STALL_RECENT_WEEKS = 8

export const getStalled = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const cutoff = new Date(
      Date.now() - STALL_RECENT_WEEKS * 7 * 24 * 60 * 60 * 1000,
    )

    const sessions = await Session.find({
      user: userId,
      endedAt: { $ne: null },
    })
      .select('startedAt entries.exercise entries.exerciseName entries.tracking entries.sets')
      .sort({ startedAt: 1 })
      .lean()

    const byExercise = new Map()

    for (const session of sessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps') continue

        let sessionBest1RM = 0
        let sessionHeaviest = 0
        for (const set of entry.sets ?? []) {
          if (!set.completed) continue
          const w = set.weightKg ?? 0
          const r = set.reps ?? 0
          if (w <= 0 || r <= 0) continue
          const e1rm = w * (1 + r / 30)
          if (e1rm > sessionBest1RM) sessionBest1RM = e1rm
          if (w > sessionHeaviest) sessionHeaviest = w
        }
        if (sessionBest1RM <= 0) continue

        const key = entry.exercise.toString()
        if (!byExercise.has(key)) {
          byExercise.set(key, { name: entry.exerciseName ?? null, points: [] })
        }
        const bucket = byExercise.get(key)
        if (entry.exerciseName) bucket.name = entry.exerciseName
        bucket.points.push({
          date: session.startedAt,
          best1RM: sessionBest1RM,
          heaviest: sessionHeaviest,
        })
      }
    }

    const stalled = []
    for (const [exerciseId, { name, points }] of byExercise) {
      let peakIndex = 0
      for (let i = 1; i < points.length; i += 1) {
        if (points[i].best1RM > points[peakIndex].best1RM) peakIndex = i
      }

      const sessionsSince = points.length - 1 - peakIndex
      const lastSessionAt = points[points.length - 1].date

      if (
        sessionsSince >= STALL_MIN_SESSIONS_SINCE_PR &&
        new Date(lastSessionAt) >= cutoff
      ) {
        let peakHeaviestKg = 0
        for (let i = 0; i <= peakIndex; i += 1) {
          if (points[i].heaviest > peakHeaviestKg) peakHeaviestKg = points[i].heaviest
        }
        stalled.push({
          exerciseId,
          exerciseName: name,
          peakBest1RM: Math.round(points[peakIndex].best1RM * 10) / 10,
          peakHeaviestKg,
          peakAt: points[peakIndex].date,
          sessionsSince,
          lastSessionAt,
        })
      }
    }

    stalled.sort(
      (a, b) =>
        b.sessionsSince - a.sessionsSince ||
        new Date(b.lastSessionAt) - new Date(a.lastSessionAt),
    )

    await attachExerciseNames(stalled)

    res.json({ stalled })
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
      createdBy: req.user.id,
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    // Drop the deleted exercise from the user's routines.
    await Routine.updateMany(
      { user: req.user.id },
      { $pull: { exercises: { exercise: deleted._id } } },
    )
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
