import mongoose from 'mongoose'
import Session from '../models/session.model.js'
import { MUSCLES } from '../models/constants.js'
import { attachExerciseNames } from '../lib/exerciseNames.js'

// Per-user global stats aggregations

const PAINTABLE_MUSCLES = MUSCLES.filter((m) => m !== 'cardio')

// GET /api/stats/muscle-recency

/** Last primary stimulus date per muscle */
export const getMuscleRecency = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const rows = await Session.aggregate([
      { $match: { user: userId } },
      { $unwind: '$entries' },
      { $unwind: '$entries.sets' },
      { $match: { 'entries.sets.completed': true } },
      {
        $group: {
          _id: '$entries.muscle',
          lastAt: { $max: '$startedAt' },
        },
      },
    ])

    const byMuscle = {}
    for (const m of PAINTABLE_MUSCLES) byMuscle[m] = null
    for (const row of rows) {
      if (row._id && byMuscle[row._id] !== undefined) {
        byMuscle[row._id] = row.lastAt
      }
    }

    res.json({
      now: new Date().toISOString(),
      byMuscle,
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/stats/records

/** All-time PR per exercise the user has trained */
export const getRecords = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const sessions = await Session.find({ user: userId })
      .select(
        'startedAt entries.exercise entries.exerciseName entries.muscle entries.tracking entries.sets',
      )
      .sort({ startedAt: 1 })
      .lean()

    const byExercise = new Map()

    function ensure(exId, meta) {
      let rec = byExercise.get(exId)
      if (!rec) {
        rec = {
          exerciseId: exId,
          exerciseName: meta.exerciseName ?? null,
          muscle: meta.muscle ?? null,
          tracking: meta.tracking ?? null,
          heaviestKg: null,
          best1RM: null,
          bestReps: null,
        }
        byExercise.set(exId, rec)
      }
      return rec
    }

    for (const session of sessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps' && entry.tracking !== 'reps') continue
        const exId = entry.exercise?.toString()
        if (!exId) continue

        for (const set of entry.sets ?? []) {
          if (!set.completed) continue

          const rec = ensure(exId, entry)

          if (entry.tracking === 'weight_reps') {
            const w = set.weightKg ?? 0
            const r = set.reps ?? 0

            if (w > 0 && (rec.heaviestKg == null || w > rec.heaviestKg.value)) {
              rec.heaviestKg = { value: w, achievedAt: session.startedAt }
            }
            if (w > 0 && r > 0) {
              const e1rm = Math.round(w * (1 + r / 30) * 10) / 10
              if (rec.best1RM == null || e1rm > rec.best1RM.value) {
                rec.best1RM = { value: e1rm, achievedAt: session.startedAt }
              }
            }
          } else {
            const r = set.reps ?? 0
            if (r > 0 && (rec.bestReps == null || r > rec.bestReps.value)) {
              rec.bestReps = { value: r, achievedAt: session.startedAt }
            }
          }
        }
      }
    }

    const records = Array.from(byExercise.values()).map((rec) => {
      const dates = [rec.heaviestKg, rec.best1RM, rec.bestReps]
        .filter(Boolean)
        .map((p) => new Date(p.achievedAt).getTime())
      const latestAt = dates.length ? new Date(Math.max(...dates)).toISOString() : null
      return { ...rec, latestAt }
    })

    records.sort((a, b) => {
      if (!a.latestAt) return 1
      if (!b.latestAt) return -1
      return new Date(b.latestAt) - new Date(a.latestAt)
    })

    await attachExerciseNames(records)

    res.json({ records })
  } catch (err) {
    next(err)
  }
}
