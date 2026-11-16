/** Shared demo account seed: realistic data for recruiters */

import dns from 'dns'

if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Exercise from '../models/exercise.model.js'
import Routine from '../models/routine.model.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import Badge from '../models/badge.model.js'
import UserBadge from '../models/userBadge.model.js'
import { DEMO_ACCOUNT } from '../models/constants.js'
import { evaluateAndPersist } from '../lib/badgeEngine.js'

const DAY_MS = 24 * 60 * 60 * 1000

const DEMO_TIME_ZONE = 'Europe/Madrid'

const WEEKS_BACK = 30
const GAP_WEEKS = [11, 12]

const RNG_SEED = 20250101

// Public catalog exercises by exact slug
export const CATALOG_SLUGS = {
  benchPress: 'barbell-bench-press',
  dumbbellBench: 'dumbbell-bench-press',
  overheadPress: 'barbell-seated-overhead-press',
  pushdown: 'cable-pushdown',
  pulldown: 'cable-lat-pulldown-full-range-of-motion',
  row: 'barbell-bent-over-row',
  pullUp: 'pull-up',
  hammerCurl: 'dumbbell-hammer-curl',
  squat: 'barbell-full-squat',
  rdl: 'barbell-romanian-deadlift',
  legPress: 'lever-alternate-leg-press',
  hamstringStretch: 'hamstring-stretch',
  treadmill: 'walking-on-incline-treadmill',
}

// Routine templates with per-exercise progression
export const ROUTINE_TEMPLATES = [
  {
    name: 'Empuje',
    description: 'Pecho, hombros y tríceps',
    exercises: [
      { slug: CATALOG_SLUGS.benchPress, sets: 4, reps: 8, startKg: 60, gainKg: 7.5 },
      { slug: CATALOG_SLUGS.dumbbellBench, sets: 3, reps: 10, startKg: 22, gainKg: 4 },
      { slug: CATALOG_SLUGS.overheadPress, sets: 3, reps: 8, startKg: 40, gainKg: 5 },
      { slug: CATALOG_SLUGS.pushdown, sets: 3, reps: 12, startKg: 25, gainKg: 5 },
    ],
  },
  {
    name: 'Tirón',
    description: 'Espalda y bíceps',
    exercises: [
      { slug: CATALOG_SLUGS.pulldown, sets: 4, reps: 10, startKg: 50, gainKg: 7.5 },
      { slug: CATALOG_SLUGS.row, sets: 4, reps: 8, startKg: 60, gainKg: 7.5 },
      { slug: CATALOG_SLUGS.pullUp, sets: 3, reps: 6, startReps: 5, gainReps: 3 },
      { slug: CATALOG_SLUGS.hammerCurl, sets: 3, reps: 12, startKg: 14, gainKg: 2 },
    ],
  },
  {
    name: 'Pierna',
    description: 'Piernas y cardio al final',
    exercises: [
      { slug: CATALOG_SLUGS.squat, sets: 4, reps: 6, startKg: 80, gainKg: 10 },
      { slug: CATALOG_SLUGS.rdl, sets: 3, reps: 8, startKg: 70, gainKg: 7.5 },
      { slug: CATALOG_SLUGS.legPress, sets: 3, reps: 12, startKg: 120, gainKg: 15 },
      { slug: CATALOG_SLUGS.hamstringStretch, sets: 2, startSec: 45, gainSec: 15 },
      { slug: CATALOG_SLUGS.treadmill, sets: 1, startM: 2500, gainM: 500, durationSec: 1200 },
    ],
  },
]

// Deterministic randomness

/** Seeded PRNG (mulberry32) */
export function createRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

function roundToStep(value, step) {
  return Math.round(value / step) * step
}

// Calendar (pure)

function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayOfWeek = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayOfWeek)
  return d
}

/** Session schedule: Mondays and Thursdays, skipping GAP_WEEKS */
export function planSessionSchedule(now = new Date(), rng = createRng(RNG_SEED)) {
  const firstMonday = mondayOf(now)
  firstMonday.setUTCDate(firstMonday.getUTCDate() - 7 * (WEEKS_BACK - 1))

  const slots = []
  for (let week = 0; week < WEEKS_BACK; week += 1) {
    if (GAP_WEEKS.includes(week)) continue
    for (const dayOffset of [0, 3]) {
      const day = new Date(firstMonday)
      day.setUTCDate(day.getUTCDate() + 7 * week + dayOffset)
      const startedAt = new Date(Date.UTC(
        day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(),
        17, 30 + randInt(rng, 0, 20),
      ))
      if (startedAt > now) continue
      slots.push(startedAt)
    }
  }

  return slots.map((startedAt, i) => ({
    startedAt,
    routineIndex: i % ROUTINE_TEMPLATES.length,
    progress: slots.length > 1 ? i / (slots.length - 1) : 1,
  }))
}

// Sets (pure): each tracking has its own fields

/** Sets of one exercise within a session */
export function buildSets(templateItem, tracking, progress, rng) {
  const sets = []
  for (let order = 0; order < templateItem.sets; order += 1) {
    switch (tracking) {
      case 'weight_reps': {
        const fatigue = order === templateItem.sets - 1 ? 1 : 0
        const weightKg = roundToStep(templateItem.startKg + templateItem.gainKg * progress, 2.5)
        sets.push({
          order,
          weightKg,
          reps: Math.max(1, templateItem.reps - fatigue + randInt(rng, -1, 1)),
          rir: randInt(rng, 0, 3),
          completed: true,
          restSec: randInt(rng, 90, 150),
        })
        break
      }
      case 'reps': {
        sets.push({
          order,
          reps: Math.max(1, Math.round(templateItem.startReps + templateItem.gainReps * progress) + randInt(rng, -1, 1)),
          rir: randInt(rng, 0, 3),
          completed: true,
          restSec: randInt(rng, 90, 150),
        })
        break
      }
      case 'time': {
        sets.push({
          order,
          durationSec: Math.round(templateItem.startSec + templateItem.gainSec * progress) + randInt(rng, -5, 5),
          completed: true,
        })
        break
      }
      case 'distance_time': {
        sets.push({
          order,
          distanceM: roundToStep(templateItem.startM + templateItem.gainM * progress, 50),
          durationSec: templateItem.durationSec + randInt(rng, -60, 60),
          completed: true,
        })
        break
      }
      default:
        throw new Error(`Tracking desconocido en la demo: ${tracking}`)
    }
  }
  return sets
}

/** Routine template fields that apply to a tracking */
export function targetFieldsFor(templateItem, tracking) {
  switch (tracking) {
    case 'weight_reps':
      return { targetSets: templateItem.sets, targetReps: templateItem.reps, targetWeightKg: templateItem.startKg }
    case 'reps':
      return { targetSets: templateItem.sets, targetReps: templateItem.startReps }
    case 'time':
      return { targetSets: templateItem.sets, targetDurationSec: templateItem.startSec }
    case 'distance_time':
      return { targetSets: templateItem.sets, targetDistanceM: templateItem.startM, targetDurationSec: templateItem.durationSec }
    default:
      throw new Error(`Tracking desconocido en la demo: ${tracking}`)
  }
}

// Persistence

/** Create or replace the demo account with its data */
export async function seedDemoUser({ now = new Date() } = {}) {
  const slugs = [...new Set(ROUTINE_TEMPLATES.flatMap((r) => r.exercises.map((e) => e.slug)))]
  const catalog = await Exercise.find({ slug: { $in: slugs }, createdBy: null }).lean()
  const bySlug = new Map(catalog.map((ex) => [ex.slug, ex]))
  const missing = slugs.filter((slug) => !bySlug.has(slug))
  if (missing.length > 0) {
    throw new Error(
      `Faltan ejercicios en el catálogo: ${missing.join(', ')}. Ejecuta \`npm run seed\` antes de sembrar la demo.`,
    )
  }

  const schedule = planSessionSchedule(now)
  const firstSessionAt = schedule[0].startedAt

  await User.updateOne(
    { email: DEMO_ACCOUNT.email },
    {
      $set: {
        username: DEMO_ACCOUNT.username,
        name: 'Demo IronTrack',
        emailVerified: true,
        privacy: 'private',
        createdAt: new Date(firstSessionAt.getTime() - 2 * DAY_MS),
        updatedAt: now,
        settings: {
          locale: 'es',
          barInputMode: 'plates',
          defaultBarWeightKg: 20,
          restTimerSec: 120,
          weeklyGoal: 2,
          suggestProgression: true,
        },
        favoriteExercises: [],
        exerciseAliases: {},
      },
    },
    { upsert: true, timestamps: false },
  )
  const user = await User.findOne({ email: DEMO_ACCOUNT.email }).select('_id').lean()

  await Promise.all([
    Session.deleteMany({ user: user._id }),
    Routine.deleteMany({ user: user._id }),
    UserBadge.deleteMany({ user: user._id }),
  ])

  const routineDocs = await Routine.insertMany(
    ROUTINE_TEMPLATES.map((template, order) => ({
      user: user._id,
      name: template.name,
      description: template.description,
      order,
      exercises: template.exercises.map((item, i) => {
        const exercise = bySlug.get(item.slug)
        return {
          exercise: exercise._id,
          order: i,
          ...targetFieldsFor(item, exercise.tracking),
        }
      }),
    })),
  )

  const rng = createRng(RNG_SEED)
  const sessionSchedule = planSessionSchedule(now, rng)
  const sessionDocs = sessionSchedule.map(({ startedAt, routineIndex, progress }) => {
    const template = ROUTINE_TEMPLATES[routineIndex]
    const routineDoc = routineDocs[routineIndex]
    const durationMin = 50 + randInt(rng, 0, 20)
    return {
      user: user._id,
      routine: routineDoc._id,
      routineName: template.name,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationMin * 60 * 1000),
      timeZone: DEMO_TIME_ZONE,
      durationEstimated: false,
      entries: template.exercises.map((item, order) => {
        const exercise = bySlug.get(item.slug)
        return {
          exercise: exercise._id,
          exerciseName: exercise.name.es || exercise.name.en,
          muscle: exercise.muscle,
          tracking: exercise.tracking,
          order,
          sets: buildSets(item, exercise.tracking, progress, rng),
        }
      }),
    }
  })
  await Session.insertMany(sessionDocs)

  for (let i = 0; i < routineDocs.length; i += 1) {
    const usedBy = sessionDocs.filter((s) => s.routine.equals(routineDocs[i]._id))
    const lastUsedAt = usedBy.reduce((max, s) => (s.startedAt > max ? s.startedAt : max), usedBy[0].startedAt)
    await Routine.updateOne(
      { _id: routineDocs[i]._id },
      { $set: { timesUsed: usedBy.length, lastUsedAt } },
    )
  }

  const catalogBadges = await Badge.countDocuments()
  if (catalogBadges === 0) {
    console.warn('[seed:demo] El catálogo de insignias está vacío. Ejecuta `npm run seed:badges`.')
  }
  const unlocked = await evaluateAndPersist(user._id)

  return {
    email: DEMO_ACCOUNT.email,
    routines: routineDocs.length,
    sessions: sessionDocs.length,
    catalogBadges,
    unlockedBadges: unlocked.length,
  }
}

// CLI: only when run directly (npm run seed:demo)

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  try {
    await connectDB()
    const summary = await seedDemoUser()
    console.log('[seed:demo] Cuenta demo lista:', summary)
  } catch (err) {
    console.error('[seed:demo] error:', err.message)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
