/*
  Progresión sugerida para ejercicios `weight_reps`.
  ---------------------------------------------------------------------------

  Función pura: entra la última sesión real del usuario (del endpoint
  /api/exercises/history), la plantilla de la rutina (sidecar `plannedSets`)
  y el equipamiento del ejercicio, y sale un seed `{ weightKg, reps, reason }`
  que el frontend aplica al pulsar un chip.

  Por qué cliente y no servidor:
    - Los datos (lastSession + plannedSets) ya viajan al montar la vista
      live. Un endpoint nuevo duplicaría trabajo.
    - La lógica es trivial y explicable (es su único argumento en contra
      de un algoritmo "serio" tipo 5/3/1): se defiende en entrevista
      diciendo exactamente qué regla aplica y cuándo.
    - Testearla es test unitario de función pura — no requiere Mongo.

  Algoritmo (nombres igual que en el código):

    addWeight: todas las series de trabajo llegaron a target reps Y el
               RIR medio fue >= 2 → súbele peso. Incremento: 2.5 kg para
               ejercicios con barra olímpica, 1 kg para el resto (dumbbell,
               cable, máquina, cuerpo). 2.5 es el disco más pequeño común
               en un gym; 1 cubre mancuernas y selectorizadas.

    addRep:    llegaste a target pero apretaste (RIR 0-1) → mantén peso y
               pide una rep más. Esto evita saltar peso mientras el sistema
               nervioso aún está adaptándose.

    deload:    alguna serie de trabajo quedó >= 2 reps por debajo del
               target → bajar 5 %, redondeado al 0.5 kg más cercano.
               Reason: si no bajamos, la siguiente sesión es la misma
               escena y el usuario se queda atascado.

    repeat:    cualquier otro caso (p. ej. RIR no registrado y reps a
               target): misma carga. Sin datos para subir, no inventamos.

  Decisiones de alcance:
    - SOLO `weight_reps`. Para `reps` (dominadas, flexiones) tendría que
      vivir una regla paralela (+1 rep); isométricos y cardio tienen su
      propia progresión por duración/distancia. Un solo PR, un solo caso.
    - Target reps viene de la plantilla (plannedSets[0].reps). Sin
      plantilla, el objetivo implícito es "lo que hiciste la última vez"
      — no se puede sugerir subir si no hay techo.
    - No tocamos series de calentamiento porque el modelo no distingue
      "trabajo" vs "warmup" (spec §7, decisión deliberada). Consideramos
      "series de trabajo" las que cargan el PESO MÁXIMO de la sesión; el
      resto se ignora para el diagnóstico. Es la aproximación que casa
      con la práctica real del usuario.
*/

const WEIGHT_PROGRESSION_KG_COMPOUND = 2.5
const WEIGHT_PROGRESSION_KG_ISOLATION = 1
const DELOAD_FACTOR = 0.95
const MIN_RIR_TO_ADD_WEIGHT = 2

// Equipment que usa barra olímpica/EZ/smith — el incremento mínimo de la
// cartela es 2.5 kg (disco de 1.25 por lado). Mancuernas, máquinas y
// bodyweight-con-lastre saltan de 1 en 1 kg.
const COMPOUND_EQUIPMENT = new Set(['barbell', 'ez-bar', 'smith'])

function roundToHalfKg(kg) {
  return Math.round(kg * 2) / 2
}

function mean(xs) {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/**
 * @param {object} params
 * @param {object|null} params.lastSession  { startedAt, sets[] } del backend
 * @param {Array|null}  params.plannedSets  sidecar del POST /sessions
 * @param {string|null} params.equipment    'barbell' | 'dumbbell' | ...
 * @returns {{ weightKg: number|null, reps: number|null, reason: string } | null}
 */
export function suggestWeightRepsProgression({ lastSession, plannedSets, equipment } = {}) {
  const isCompound = equipment == null || COMPOUND_EQUIPMENT.has(equipment)
  const increment = isCompound
    ? WEIGHT_PROGRESSION_KG_COMPOUND
    : WEIGHT_PROGRESSION_KG_ISOLATION

  const planned = plannedSets?.[0] ?? null
  const plannedSeed = planned
    ? { weightKg: planned.weightKg ?? null, reps: planned.reps ?? null, reason: 'planned' }
    : null

  const sets = (lastSession?.sets ?? []).filter(
    (s) => s.weightKg != null && s.reps != null,
  )
  if (sets.length === 0) return plannedSeed

  // Series de trabajo: las que cargan el peso MÁXIMO de la sesión. Al tipo
  // le interesa progresar sobre su carga real, no sobre el calentamiento.
  const topWeight = Math.max(...sets.map((s) => s.weightKg))
  const workingSets = sets.filter((s) => s.weightKg === topWeight)

  const targetReps = planned?.reps ?? Math.max(...workingSets.map((s) => s.reps))

  const rirs = workingSets.map((s) => s.rir).filter((r) => r != null)
  const avgRir = mean(rirs)

  const hitTarget = workingSets.every((s) => s.reps >= targetReps)
  const missedBadly = workingSets.some((s) => s.reps <= targetReps - 2)

  if (hitTarget && avgRir != null && avgRir >= MIN_RIR_TO_ADD_WEIGHT) {
    return {
      weightKg: roundToHalfKg(topWeight + increment),
      reps: targetReps,
      reason: 'addWeight',
    }
  }
  if (hitTarget && (avgRir == null || avgRir < MIN_RIR_TO_ADD_WEIGHT)) {
    return {
      weightKg: topWeight,
      reps: targetReps + 1,
      reason: 'addRep',
    }
  }
  if (missedBadly) {
    return {
      weightKg: roundToHalfKg(topWeight * DELOAD_FACTOR),
      reps: targetReps,
      reason: 'deload',
    }
  }
  return {
    weightKg: topWeight,
    reps: targetReps,
    reason: 'repeat',
  }
}
