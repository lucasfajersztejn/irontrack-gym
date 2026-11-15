import Exercise from '../models/exercise.model.js'

/**
 * Devuelve un Map<idString, { es, en }> con el nombre bilingüe del catálogo
 * para los ids dados, en una sola consulta.
 *
 * Por qué existe: los endpoints de progreso (records, recent-prs, stalled) se
 * construyen a partir del snapshot `Session.entries.exerciseName`, que es UN
 * solo string. El frontend no puede traducirlo porque no tiene las dos
 * variantes. El catálogo (`Exercise.name`) sí es `{ es, en }`, así que lo
 * adjuntamos para que la UI pinte el idioma activo. El snapshot se conserva
 * como respaldo para ejercicios borrados (que ya no están en el catálogo).
 *
 * No filtra por usuario a propósito: los ids ya salen de las sesiones del
 * propio usuario (globales o sus customs) y el nombre de un ejercicio es dato
 * público de catálogo, no información privada. No hay fuga de datos ajenos.
 */
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

/**
 * Adjunta `name` (bilingüe) a cada fila que tenga `exerciseId`, mutando el
 * array in situ. Deja `name: null` si el ejercicio ya no está en el catálogo;
 * la UI cae entonces al snapshot `exerciseName`.
 */
export async function attachExerciseNames(rows) {
  const nameMap = await fetchExerciseNameMap(rows.map((r) => r.exerciseId))
  for (const row of rows) {
    row.name = nameMap.get(String(row.exerciseId)) ?? null
  }
  return rows
}
