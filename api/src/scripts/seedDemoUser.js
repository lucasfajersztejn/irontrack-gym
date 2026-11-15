/**
 * Cuenta demo compartida: datos realistas para que un reclutador vea el
 * producto con un clic (heatmap, récords, 1RM estimado e insignias).
 *
 * Qué hace:
 *   1. Upsert del usuario demo por email (idempotente).
 *   2. Borra sus rutinas, sesiones e insignias previas (reseed limpio).
 *   3. Crea 3 plantillas (Routine) y ~55 sesiones (Session) repartidas en ~7
 *      meses, con series reales según el `tracking` de cada ejercicio.
 *   4. Evalúa las insignias con el mismo motor que usa la app al cerrar sesión.
 *
 * La misma función sirve a la CLI (`npm run seed:demo`) y a la ruta admin de
 * reseed (POST /api/admin/demo/reseed). Así no hay dos versiones de los datos.
 */

import dns from 'dns'

// Mismo arreglo de DNS que los demás scripts y que api/src/index.js.
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

// Zona en la que "se entrenó" la demo. Va en cada sesión (`timeZone`) porque
// de ella salen las medallas de calendario (madrugador, fin de semana...).
const DEMO_TIME_ZONE = 'Europe/Madrid'

// Historia: 30 semanas, con dos semanas sin entrenar. El hueco hace que la
// medalla de "vuelta tras un parón" tenga algo que mostrar.
const WEEKS_BACK = 30
const GAP_WEEKS = [11, 12]

// Semilla fija: mismos datos en cada reseed (las fechas sí se mueven con el
// reloj). Un número fijo hace que los tests y la demo sean reproducibles.
const RNG_SEED = 20250101

/*
  Ejercicios del catálogo público, por slug exacto. Un slug fijo en vez de
  "el primer ejercicio de pecho con barra" evita que la demo cambie de
  ejercicios si cambia el orden del catálogo. El `tracking` NO se escribe aquí:
  el builder lo lee del ejercicio real, así que una serie nunca se monta a
  mano con campos que el tracking no tiene (invariante 7).
*/
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

/*
  Plantillas. Cada ejercicio lleva su progresión: `start*` es lo que se hacía
  al principio y `gain*` lo que se sube en los 7 meses. Así los récords y el
  1RM estimado crecen de forma creíble en vez de quedarse planos.
  Los campos de peso/reps/tiempo/distancia dependen del tracking del ejercicio;
  el builder usa solo los que ese tracking admite.
*/
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

// ---------------------------------------------------------------------------
// Aleatoriedad determinista
// ---------------------------------------------------------------------------

/**
 * Generador pseudoaleatorio con semilla (mulberry32). Usamos uno propio en vez
 * de Math.random porque Math.random no se puede fijar: cada reseed daría
 * sesiones distintas y los tests no serían reproducibles.
 */
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

// Los discos se cargan de 2,5 kg: un peso como 61,3 kg no lo vería nadie en el
// gimnasio y se nota a simple vista en la demo.
function roundToStep(value, step) {
  return Math.round(value / step) * step
}

// ---------------------------------------------------------------------------
// Calendario (puro)
// ---------------------------------------------------------------------------

function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayOfWeek = (d.getUTCDay() + 6) % 7 // lunes=0 … domingo=6
  d.setUTCDate(d.getUTCDate() - dayOfWeek)
  return d
}

/**
 * Reparte las sesiones en lunes y jueves de cada semana, saltando las semanas
 * de GAP_WEEKS. Devuelve las sesiones en orden cronológico con su plantilla
 * (rotación A, B, C) y su progresión (0 = primera sesión, 1 = la última).
 *
 * Las sesiones posteriores a `now` se descartan: una demo no puede tener
 * entrenos del futuro.
 */
export function planSessionSchedule(now = new Date(), rng = createRng(RNG_SEED)) {
  const firstMonday = mondayOf(now)
  firstMonday.setUTCDate(firstMonday.getUTCDate() - 7 * (WEEKS_BACK - 1))

  const slots = []
  for (let week = 0; week < WEEKS_BACK; week += 1) {
    if (GAP_WEEKS.includes(week)) continue
    for (const dayOffset of [0, 3]) {
      const day = new Date(firstMonday)
      day.setUTCDate(day.getUTCDate() + 7 * week + dayOffset)
      // 17:30 UTC + hasta 20 min: son las 18:30–19:20 en Madrid, hora de gimnasio.
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

// ---------------------------------------------------------------------------
// Series (puro): cada tracking tiene sus propios campos
// ---------------------------------------------------------------------------

/**
 * Series de un ejercicio dentro de una sesión. El tracking viene del ejercicio
 * real del catálogo (no de la plantilla). Un tracking desconocido es un error
 * explícito y no un caso por defecto silencioso.
 */
export function buildSets(templateItem, tracking, progress, rng) {
  const sets = []
  for (let order = 0; order < templateItem.sets; order += 1) {
    switch (tracking) {
      case 'weight_reps': {
        // La última serie de cada ejercicio suele caer una rep: fatiga real.
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

/**
 * Campos de la plantilla (Routine) que tienen sentido para ese tracking. Los
 * `target*` son intenciones: lo que el usuario se planeó, no lo que hizo.
 */
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

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

/**
 * Crea o reemplaza la cuenta demo con sus datos. Devuelve un resumen para la
 * CLI o la respuesta del admin.
 *
 * `now` es inyectable para tests deterministas.
 */
export async function seedDemoUser({ now = new Date() } = {}) {
  // 1. Catálogo: sin ejercicios no hay sesiones que escribir. Fallamos antes de
  // tocar ningún dato, así un reseed a medias no deja la demo sin rutinas.
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

  // 2. Usuario. Upsert por email, sin validadores: `username: 'demo'` está en
  // RESERVED_USERNAMES para que ningún usuario real lo reclame, y esa misma
  // lista bloquearía el alta de la propia demo. Es una vía de operador, no de
  // usuario, así que la saltamos a propósito.
  // `timestamps: false` porque fijamos createdAt a mano: la cuenta parece tener
  // ~7 meses, así las medallas de antigüedad se ven como en una cuenta real.
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
        // Valores por defecto del schema, escritos a mano: `settings` es un
        // subdocumento y así el reseed deja la cuenta exactamente como la demo.
        settings: {
          locale: 'es',
          barInputMode: 'plates',
          defaultBarWeightKg: 20,
          restTimerSec: 120,
          weeklyGoal: 4,
          suggestProgression: true,
        },
        favoriteExercises: [],
        exerciseAliases: {},
      },
    },
    { upsert: true, timestamps: false },
  )
  const user = await User.findOne({ email: DEMO_ACCOUNT.email }).select('_id').lean()

  // 3. Reseed limpio: todo lo de la demo sale y vuelve a entrar desde cero.
  await Promise.all([
    Session.deleteMany({ user: user._id }),
    Routine.deleteMany({ user: user._id }),
    UserBadge.deleteMany({ user: user._id }),
  ])

  // 4. Plantillas.
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

  // 5. Sesiones. El rng avanza en orden fijo, así que el mismo `now` da los
  // mismos datos siempre.
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
          // El nombre en español: la cuenta demo arranca en locale 'es'.
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

  // Contadores de uso de cada plantilla, igual que hace la app al crear sesiones.
  for (let i = 0; i < routineDocs.length; i += 1) {
    const usedBy = sessionDocs.filter((s) => s.routine.equals(routineDocs[i]._id))
    const lastUsedAt = usedBy.reduce((max, s) => (s.startedAt > max ? s.startedAt : max), usedBy[0].startedAt)
    await Routine.updateOne(
      { _id: routineDocs[i]._id },
      { $set: { timesUsed: usedBy.length, lastUsedAt } },
    )
  }

  // 6. Insignias: el mismo motor que se dispara al cerrar una sesión real.
  // Sin catálogo de insignias no hay nada que desbloquear; no es un error de la
  // demo, pero se avisa para que el operador sepa por qué el muro sale vacío.
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

// ---------------------------------------------------------------------------
// CLI: solo si se ejecuta directamente (`npm run seed:demo`). Al importarlo
// desde la ruta admin o desde los tests no se conecta ni se desconecta nada.
// ---------------------------------------------------------------------------

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
