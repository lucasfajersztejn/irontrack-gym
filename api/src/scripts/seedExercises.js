/**
 * Importa el catálogo público de ejercicios desde ExerciseGymGifsDB (jsDelivr).
 *
 * Qué hace, paso a paso:
 *   1. Se conecta a Mongo.
 *   2. Por cada uno de los 19 músculos, pide el JSON en ES y EN en paralelo.
 *   3. Cruza por `slug` para armar name:{es,en} e instructions:{es,en}.
 *   4. Infiere `tracking` desde (category, equipment).
 *   5. Upsert por (slug + createdBy:null): catálogo global, idempotente,
 *      correrlo dos veces no duplica. Los customs del usuario no se tocan
 *      porque filtran por createdBy:null.
 *
 * Por qué JSDelivr y no WorkoutX: WorkoutX tenía cuota (500 req/día) y una
 * key que caducaba. Esto es un CDN público, sin registro, gratis, con tag de
 * versión fijado — si el autor renombra algo, no rompe 1300 imágenes.
 *
 * Uso:  npm run seed
 */

import dns from 'dns'

// Mismo arreglo que api/src/index.js: redes locales que no resuelven los SRV
// de Atlas. Opt-in via env var para no imponerlo donde no haga falta.
if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Exercise from '../models/exercise.model.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
  CATEGORIES,
  BAR_EQUIPMENT,
  DEFAULT_BAR_WEIGHTS_KG,
} from '../models/constants.js'

const BASE_URL =
  'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api'

// Sets de validación. Son hashsets para que `has()` sea O(1) por lookup, que
// a 1323 ejercicios × 4 campos empieza a notarse.
const MUSCLE_SET = new Set(MUSCLES)
const BODY_PART_SET = new Set(BODY_PARTS)
const EQUIPMENT_SET = new Set(EQUIPMENT)
const CATEGORY_SET = new Set(CATEGORIES)

/**
 * Mapa de category + equipment -> tracking. Es la regla que explicita la §3.3
 * de la spec. Vive aquí (y no en constants) porque es específica del seed:
 * ningún otro código la consume.
 */
function inferTracking(category, equipment) {
  if (category === 'cardio') return 'distance_time'
  if (category === 'stretching') return 'time'
  if (category === 'plyometrics') return 'reps'
  // Resto: strength. Con bodyweight no hay peso externo que anotar.
  if (equipment === 'bodyweight') return 'reps'
  return 'weight_reps'
}

async function fetchMuscle(muscle, lang) {
  const url = `${BASE_URL}/${lang}/muscles/${muscle}.json`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${lang}/${muscle}: HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Devuelve un doc listo para Mongoose, o null si la fila trae valores fuera
 * de los enums. Preferimos saltar y log antes que coaccionar a 'other':
 * meter basura en el catálogo rompe más búsquedas de las que arregla.
 */
function buildDoc(es, en) {
  const problems = []
  if (!MUSCLE_SET.has(es.muscle)) problems.push(`muscle=${es.muscle}`)
  if (!BODY_PART_SET.has(es.bodyPart)) problems.push(`bodyPart=${es.bodyPart}`)
  if (!EQUIPMENT_SET.has(es.equipment)) problems.push(`equipment=${es.equipment}`)
  if (!CATEGORY_SET.has(es.category)) problems.push(`category=${es.category}`)
  if (problems.length > 0) {
    return { skip: true, reason: problems.join(', ') }
  }

  return {
    doc: {
      slug: es.slug,
      name: { es: es.name, en: en.name },
      muscle: es.muscle,
      bodyPart: es.bodyPart,
      equipment: es.equipment,
      category: es.category,
      // Filtramos secundarios para no violar el enum: el repo a veces lista
      // regiones ("neck", "wrist") que no están en MUSCLES.
      secondaryMuscles: (es.secondaryMuscles || []).filter((m) =>
        MUSCLE_SET.has(m),
      ),
      instructions: {
        es: es.instructions || [],
        en: en.instructions || [],
      },
      gifUrl: es.gifUrl,
      tracking: inferTracking(es.category, es.equipment),

      // Duplica la regla del pre('validate') de exercise.model.js. Mongoose
      // no corre hooks en bulkWrite({updateOne, upsert}), así que si no lo
      // calculo aquí usesBar queda en false para todos y las barras pierden
      // su peso en las estadísticas. La fuente de verdad sigue siendo
      // constants.js — este archivo solo la aplica.
      usesBar: BAR_EQUIPMENT.includes(es.equipment),
      defaultBarWeightKg: BAR_EQUIPMENT.includes(es.equipment)
        ? (DEFAULT_BAR_WEIGHTS_KG[es.equipment] ?? 20)
        : null,

      createdBy: null,
    },
  }
}

async function processMuscle(muscle) {
  const [es, en] = await Promise.all([
    fetchMuscle(muscle, 'es'),
    fetchMuscle(muscle, 'en'),
  ])

  // Mapa por slug para pareo determinista. Si el repo añade un ejercicio en
  // un idioma pero no en el otro, lo saltamos.
  const enBySlug = new Map(en.exercises.map((x) => [x.slug, x]))

  const ops = []
  let skipped = 0
  for (const esEx of es.exercises) {
    const enEx = enBySlug.get(esEx.slug)
    if (!enEx) {
      skipped++
      console.warn(`  [skip] ${esEx.slug}: sin traducción EN`)
      continue
    }

    const built = buildDoc(esEx, enEx)
    if (built.skip) {
      skipped++
      console.warn(`  [skip] ${esEx.slug}: ${built.reason}`)
      continue
    }

    // Upsert idempotente: match por (slug + createdBy:null), que es el índice
    // único ya definido en exercise.model.js. $set reemplaza, no acumula.
    ops.push({
      updateOne: {
        filter: { slug: built.doc.slug, createdBy: null },
        update: { $set: built.doc },
        upsert: true,
      },
    })
  }

  if (ops.length === 0) {
    return { muscle, upserted: 0, modified: 0, skipped }
  }

  const result = await Exercise.bulkWrite(ops, { ordered: false })
  return {
    muscle,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
    skipped,
  }
}

async function main() {
  await connectDB()
  console.log(`Seed arrancado. Músculos: ${MUSCLES.length}`)

  const totals = { upserted: 0, modified: 0, skipped: 0 }
  for (const muscle of MUSCLES) {
    try {
      const r = await processMuscle(muscle)
      totals.upserted += r.upserted
      totals.modified += r.modified
      totals.skipped += r.skipped
      console.log(
        `[${muscle}] upserted=${r.upserted} modified=${r.modified} skipped=${r.skipped}`,
      )
    } catch (err) {
      // Un músculo que falla no debe tumbar el seed entero: 18 de 19 músculos
      // es un resultado útil; cero es un rato perdido.
      console.error(`[${muscle}] ERROR: ${err.message}`)
    }
  }

  console.log(
    `\nTotal: upserted=${totals.upserted} modified=${totals.modified} skipped=${totals.skipped}`,
  )

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Seed falló:', err)
  process.exit(1)
})
