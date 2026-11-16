import Exercise from '../models/exercise.model.js'

/** Map of exercise id to bilingual name for the given ids */
export async function fetchExerciseNameMap(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (unique.length === 0) return new Map()

  const docs = await Exercise.find({ _id: { $in: unique } })
    .select('name')
    .lean()

  const map = new Map()
  for (const doc of docs) map.set(String(doc._id), doc.name ?? null)
  return map
}

/** Attach the bilingual name to each row that has an exerciseId, in place */
export async function attachExerciseNames(rows) {
  const nameMap = await fetchExerciseNameMap(rows.map((r) => r.exerciseId))
  for (const row of rows) {
    row.name = nameMap.get(String(row.exerciseId)) ?? null
  }
  return rows
}
