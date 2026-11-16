/** Import the public exercise catalog from ExerciseGymGifsDB (jsDelivr) */

import dns from 'dns'

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

const MUSCLE_SET = new Set(MUSCLES)
const BODY_PART_SET = new Set(BODY_PARTS)
const EQUIPMENT_SET = new Set(EQUIPMENT)
const CATEGORY_SET = new Set(CATEGORIES)

/** Map category + equipment to tracking */
function inferTracking(category, equipment) {
  if (category === 'cardio') return 'distance_time'
  if (category === 'stretching') return 'time'
  if (category === 'plyometrics') return 'reps'
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

/** Build a Mongoose-ready doc, or null for out-of-enum rows */
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
      secondaryMuscles: (es.secondaryMuscles || []).filter((m) =>
        MUSCLE_SET.has(m),
      ),
      instructions: {
        es: es.instructions || [],
        en: en.instructions || [],
      },
      gifUrl: es.gifUrl,
      tracking: inferTracking(es.category, es.equipment),

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
