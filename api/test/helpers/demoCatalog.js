import Exercise from '../../src/models/exercise.model.js'
import { CATALOG_SLUGS } from '../../src/scripts/seedDemoUser.js'

/*
  Catálogo mínimo para sembrar la demo en tests. Los slugs son los REALES del
  catálogo público (ExerciseGymGifsDB) y los trackings son los que da
  inferTracking(category, equipment) en seedExercises.js. Así el test no
  depende de jsDelivr, pero sí de la misma forma de datos que en producción.
*/
const FIXTURE_BY_KEY = {
  benchPress: { muscle: 'pectorals', equipment: 'barbell', tracking: 'weight_reps' },
  dumbbellBench: { muscle: 'pectorals', equipment: 'dumbbell', tracking: 'weight_reps' },
  overheadPress: { muscle: 'delts', equipment: 'barbell', tracking: 'weight_reps' },
  pushdown: { muscle: 'triceps', equipment: 'cable', tracking: 'weight_reps' },
  pulldown: { muscle: 'lats', equipment: 'cable', tracking: 'weight_reps' },
  row: { muscle: 'upper-back', equipment: 'barbell', tracking: 'weight_reps' },
  pullUp: { muscle: 'lats', equipment: 'bodyweight', tracking: 'reps' },
  hammerCurl: { muscle: 'biceps', equipment: 'dumbbell', tracking: 'weight_reps' },
  squat: { muscle: 'glutes', equipment: 'barbell', tracking: 'weight_reps' },
  rdl: { muscle: 'glutes', equipment: 'barbell', tracking: 'weight_reps' },
  legPress: { muscle: 'quads', equipment: 'lever', tracking: 'weight_reps' },
  hamstringStretch: { muscle: 'hamstrings', equipment: 'bodyweight', tracking: 'time' },
  treadmill: { muscle: 'cardio', equipment: 'machine', tracking: 'distance_time' },
}

export async function insertDemoCatalog() {
  const docs = Object.entries(CATALOG_SLUGS).map(([key, slug]) => ({
    slug,
    createdBy: null,
    name: { es: `Ejercicio ${slug}`, en: slug },
    ...FIXTURE_BY_KEY[key],
  }))
  return Exercise.insertMany(docs)
}
