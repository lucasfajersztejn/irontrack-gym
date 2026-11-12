/*
  Motor de insignias — Fase 3.
  ---------------------------------------------------------------------------

  Dos capas, separadas a propósito:

    1. Funciones PURAS (computeUserMetrics, evaluateBadges) que no tocan Mongo:
       dado un array de sesiones y un catálogo, dicen qué métricas tiene el
       usuario y qué insignias cumple. Se testean sin base de datos y se
       explican en voz alta — que es el objetivo del proyecto.

    2. Una función de servicio (evaluateAndPersist) que orquesta: lee de la DB,
       llama a las puras, y escribe los desbloqueos nuevos.

  La regla de cada insignia es DECLARATIVA (`{ type, operator, value }`). El
  motor no sabe qué insignias existen; sabe cómo medir unas pocas métricas y
  cómo comparar. Añadir "racha de 100 días" es un documento más en el catálogo,
  no una rama nueva aquí.
*/

import Session from '../models/session.model.js'
import Badge from '../models/badge.model.js'
import UserBadge from '../models/userBadge.model.js'
import User from '../models/user.model.js'
import { MUSCLE_TO_BODY_PART } from '../models/constants.js'

/**
 * Campos de `Session` que el motor necesita. Se exporta para que el servicio
 * (evaluateAndPersist) y el muro (badgeController.getBadges) lean EXACTAMENTE
 * lo mismo: si uno amplía la proyección y el otro no, las medallas del muro y
 * las que se conceden al cerrar sesión dejan de coincidir sin que nada falle.
 */
export const SESSION_METRIC_SELECT =
  'startedAt timeZone entries.exercise entries.muscle entries.tracking entries.sets.weightKg entries.sets.reps entries.sets.completed'

// ---------------------------------------------------------------------------
// Métricas derivadas de las sesiones
// ---------------------------------------------------------------------------

/**
 * Partes de calendario LOCAL de una sesión, en la zona en la que se entrenó.
 *
 * `startedAt` es un instante absoluto; la zona (`timeZone`, IANA) se guardó al
 * crear la sesión. Con las dos cosas derivamos el día, el mes, la semana ISO y
 * el día de la semana TAL COMO los vivió el usuario, no como caen en UTC ni en
 * la zona de quien mira la pantalla después. Una sesión a las 02:00Z en
 * Argentina (UTC-3) fue a las 23:00 del día ANTERIOR: eso es lo que cuenta para
 * la racha y el fin de semana.
 *
 * Sin `timeZone` (datos viejos, backfill) el fallback es UTC: determinista y
 * equivalente al comportamiento anterior, en vez de inventar una zona.
 *
 * Devuelve también `weekStartMs`: el lunes 00:00 (como instante UTC construido
 * desde la fecha local) de la semana ISO. Sirve para medir semanas consecutivas
 * sin volver a mezclar zonas.
 */
function localParts(dateLike, timeZone) {
  const d = new Date(dateLike)
  const fmt = (tz) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23', // 00..23, sin "24" a medianoche
    }).formatToParts(d)
  let parts
  try {
    parts = fmt(timeZone || 'UTC')
  } catch {
    // Zona inválida -> UTC. No debería ocurrir (se valida al crear), pero el
    // motor nunca debe romper por un dato sucio.
    parts = fmt('UTC')
  }
  const get = (t) => parts.find((p) => p.type === t).value
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  const hour = Number(get('hour'))

  // La fecha local se trata como un instante UTC para derivar día de semana e
  // ISO week de forma determinista (ya no hay zona de por medio: es una fecha).
  const localUtc = new Date(Date.UTC(year, month - 1, day))
  const weekday = localUtc.getUTCDay() // 0=domingo … 6=sábado
  const mondayOffset = (weekday + 6) % 7 // lunes=0 … domingo=6
  const weekStartMs = Date.UTC(year, month - 1, day - mondayOffset)

  return {
    dayKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    weekday,
    weekStartMs,
    hour,
  }
}

function dayKeyToUtcMs(key) {
  const [y, m, d] = key.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/**
 * Racha máxima: la tira más larga de días naturales CONSECUTIVOS con al menos
 * una sesión. Es la racha histórica, no la actual: si el usuario llegó a 34
 * días y luego faltó, "streak-30" sigue ganada (ver userBadge.model).
 */
function maxConsecutiveDays(dayKeys) {
  if (dayKeys.length === 0) return 0
  const sorted = [...new Set(dayKeys)].sort()
  const DAY = 24 * 60 * 60 * 1000
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = dayKeyToUtcMs(sorted[i]) - dayKeyToUtcMs(sorted[i - 1])
    run = gap === DAY ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/**
 * Máxima tira de valores CONSECUTIVOS separados exactamente por `step` ms.
 * Mismo patrón que maxConsecutiveDays pero sobre instantes (lo usamos para
 * semanas: cada entrada es el lunes de una semana que cumplió la meta, y
 * "consecutivas" = lunes separados por 7 días).
 */
function maxConsecutiveSteps(msValues, step) {
  if (msValues.length === 0) return 0
  const sorted = [...new Set(msValues)].sort((a, b) => a - b)
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i += 1) {
    run = sorted[i] - sorted[i - 1] === step ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/**
 * Cuenta los récords personales batidos a lo largo del histórico.
 *
 * Un "récord" es una mejora del mejor valor de un ejercicio:
 *  - weight_reps: mejor 1RM estimado (Epley `w * (1 + r/30)`, redondeado a 0,1
 *    igual que statsController.getRecords, para que el muro y los récords de
 *    la app digan lo mismo).
 *  - reps: mejor número de repeticiones.
 * Otros trackings (tiempo, distancia) no tienen récord en este motor.
 *
 * Reglas, decididas así a propósito:
 *  - El orden importa: "batir" solo tiene sentido frente a lo anterior. Por eso
 *    la función ordena una COPIA por startedAt y no depende de que el caller lo
 *    haga (el sort de la consulta es defensa en profundidad, no el contrato).
 *  - La PRIMERA vez que se registra un ejercicio cuenta como su primer récord:
 *    pasar de no tener marca a tener una es lograr un récord.
 *  - Máximo UN récord por (sesión, ejercicio): si en la misma sesión mejoras
 *    cinco veces el mismo ejercicio, es una sesión con un récord, no cinco. Un
 *    ejercicio distinto en esa sesión sí suma el suyo.
 *  - Solo series completadas con valor positivo (como en el resto del motor).
 */
function countPersonalRecords(sessions) {
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.startedAt) - new Date(b.startedAt),
  )
  // exerciseId -> mejor valor histórico (1RM estimado o reps). Un único número
  // basta porque el tracking de un ejercicio no cambia entre sesiones.
  const bestByExercise = new Map()
  let prCount = 0

  for (const session of chronological) {
    // Ejercicios que ya han sumado récord en ESTA sesión.
    const recordedThisSession = new Set()

    for (const entry of session.entries ?? []) {
      if (!entry.exercise) continue
      const exId = String(entry.exercise)
      const isWeightReps = entry.tracking === 'weight_reps'
      if (!isWeightReps && entry.tracking !== 'reps') continue

      for (const set of entry.sets ?? []) {
        if (!set.completed) continue
        const r = set.reps ?? 0
        let value
        if (isWeightReps) {
          const w = set.weightKg ?? 0
          if (w <= 0 || r <= 0) continue
          value = Math.round(w * (1 + r / 30) * 10) / 10
        } else {
          if (r <= 0) continue
          value = r
        }

        // Sin marca previa (undefined) es la primera vez: cuenta como récord.
        // Un valor igual o menor que la marca no lo es.
        const previous = bestByExercise.get(exId)
        if (previous === undefined || value > previous) {
          bestByExercise.set(exId, value)
          if (!recordedThisSession.has(exId)) {
            recordedThisSession.add(exId)
            prCount += 1
          }
        }
      }
    }
  }

  return prCount
}

/**
 * Convierte las sesiones cerradas en las métricas que el motor compara.
 * Entrada: documentos de sesión (lean) con startedAt, timeZone y entries[].sets[].
 * Solo cuentan las series `completed` con peso y reps > 0 para el volumen,
 * mismo criterio que el resto de agregaciones (una serie a medio escribir no
 * mueve nada).
 *
 * `opts` trae datos que NO viven en las sesiones:
 *  - `weeklyGoal`: sesiones/semana que el usuario se fijó (user.weeklyGoal). Es
 *    el umbral de "semana cumplida".
 *  - `createdAt`: alta de la cuenta, para la antigüedad.
 *  - `now`: inyectable para tests deterministas.
 */
export function computeUserMetrics(
  sessions = [],
  { weeklyGoal = 4, createdAt = null, now = new Date() } = {},
) {
  let totalVolumeKg = 0
  let totalReps = 0
  let totalSets = 0
  let maxSessionVolumeKg = 0
  let maxSetsInSession = 0
  let maxWeightSingleKg = 0
  let weekendSessions = 0
  let earlyBirdSessions = 0
  let nightOwlSessions = 0
  const dayKeys = []
  const monthKeys = new Set()
  // weekStartMs (lunes local) -> nº de sesiones de esa semana.
  const weekCounts = new Map()
  // weekStartMs -> Set de días distintos de esa semana, para "cuadrícula llena".
  const weekDays = new Map()
  // Variedad: partes del cuerpo y ejercicios se miden solo con series
  // completadas (una entry sin ninguna hecha no cuenta como entrenada).
  const bodyPartsAll = new Set()
  const exercisesAll = new Set()
  // weekStartMs -> partes del cuerpo entrenadas esa semana.
  const weekBodyParts = new Map()
  // dayKey -> partes del cuerpo entrenadas ese día (base de la ventana de 30 días).
  const dayBodyParts = new Map()
  let cardioSessions = 0
  // Forma de calendario: semanas ISO distintas por mes natural (monthKey ->
  // Set de weekStartMs), días de la semana entrenados (weekStartMs -> Set de
  // weekday) y volumen (kg) por semana (weekStartMs -> kg). El volumen solo
  // existe para semanas con alguna serie de peso válida: una semana sin volumen
  // registrado no sirve de referencia para "superó a la anterior".
  const monthWeeks = new Map()
  const weekWeekdays = new Map()
  const weekVolume = new Map()

  for (const s of sessions) {
    // Día, mes, semana, día-de-semana y hora en la zona donde se entrenó.
    const { dayKey, monthKey, weekday, weekStartMs, hour } = localParts(s.startedAt, s.timeZone)
    dayKeys.push(dayKey)
    monthKeys.add(monthKey)
    weekCounts.set(weekStartMs, (weekCounts.get(weekStartMs) ?? 0) + 1)
    if (!weekDays.has(weekStartMs)) weekDays.set(weekStartMs, new Set())
    weekDays.get(weekStartMs).add(dayKey)
    if (!monthWeeks.has(monthKey)) monthWeeks.set(monthKey, new Set())
    monthWeeks.get(monthKey).add(weekStartMs)
    if (!weekWeekdays.has(weekStartMs)) weekWeekdays.set(weekStartMs, new Set())
    weekWeekdays.get(weekStartMs).add(weekday)
    if (weekday === 0 || weekday === 6) weekendSessions += 1 // domingo o sábado
    // Franjas horarias locales fijas: madrugada = antes de las 07:00, noche =
    // 22:00 o más tarde. El motor cuenta cuántas sesiones caen en cada franja;
    // cuántas hacen falta para la medalla es el `value` de la regla.
    if (hour < 7) earlyBirdSessions += 1
    if (hour >= 22) nightOwlSessions += 1

    // Acumuladores POR sesión, para derivar los máximos "en una sola sesión"
    // sin un segundo recorrido. El volumen de sesión usa el mismo criterio que
    // el total (solo weight_reps completadas con peso y reps > 0).
    let sessionVolumeKg = 0
    let sessionSets = 0
    const sessionBodyParts = new Set()
    let sessionHasCardio = false

    for (const entry of s.entries ?? []) {
      // Una entry cuenta como "ejercicio hecho" solo si tiene alguna serie completada.
      let entryDone = false
      for (const set of entry.sets ?? []) {
        if (!set.completed) continue
        entryDone = true

        // Una serie completada cuenta como serie sea cual sea el tracking: un
        // isométrico o un tramo de cardio también es trabajo hecho.
        totalSets += 1
        sessionSets += 1

        // reps existen en weight_reps y en reps; time/distance no las tienen.
        const r = set.reps ?? 0
        if (r > 0) totalReps += r

        // Peso y volumen solo tienen sentido en weight_reps.
        if (entry.tracking !== 'weight_reps') continue
        const w = set.weightKg ?? 0
        if (w > 0 && r > 0) {
          totalVolumeKg += w * r
          sessionVolumeKg += w * r
        }
        // El récord de peso es el mayor levantado en UNA serie real (con reps),
        // no un peso cargado y no ejecutado.
        if (w > 0 && r > 0 && w > maxWeightSingleKg) maxWeightSingleKg = w
      }

      if (entryDone) {
        // La entry ya trae el ejercicio y el músculo denormalizados (ver
        // session.model): no hace falta consultar el catálogo.
        if (entry.exercise) exercisesAll.add(String(entry.exercise))
        const bodyPart = MUSCLE_TO_BODY_PART[entry.muscle]
        if (bodyPart) {
          sessionBodyParts.add(bodyPart)
          if (bodyPart === 'cardio') sessionHasCardio = true
        }
      }
    }

    if (sessionVolumeKg > maxSessionVolumeKg) maxSessionVolumeKg = sessionVolumeKg
    if (sessionSets > maxSetsInSession) maxSetsInSession = sessionSets
    if (sessionVolumeKg > 0) {
      weekVolume.set(weekStartMs, (weekVolume.get(weekStartMs) ?? 0) + sessionVolumeKg)
    }

    if (sessionHasCardio) cardioSessions += 1
    if (sessionBodyParts.size > 0) {
      if (!weekBodyParts.has(weekStartMs)) weekBodyParts.set(weekStartMs, new Set())
      if (!dayBodyParts.has(dayKey)) dayBodyParts.set(dayKey, new Set())
      for (const bp of sessionBodyParts) {
        bodyPartsAll.add(bp)
        weekBodyParts.get(weekStartMs).add(bp)
        dayBodyParts.get(dayKey).add(bp)
      }
    }
  }

  // Semanas que cumplieron la meta, por su lunes. "Ritmo perfecto" pide que
  // sean CONSECUTIVAS (decisión de producto), así que medimos la mayor tira de
  // lunes separados por 7 días exactos.
  const goalWeekMondays = []
  for (const [weekStartMs, count] of weekCounts) {
    if (count >= weeklyGoal) goalWeekMondays.push(weekStartMs)
  }
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const DAY = 24 * 60 * 60 * 1000

  // Cuadrícula llena: la semana con más días DISTINTOS entrenados (máx 7).
  let maxDaysInWeek = 0
  for (const days of weekDays.values()) {
    if (days.size > maxDaysInWeek) maxDaysInWeek = days.size
  }

  // Vuelta al ruedo: mayor separación (en días) entre dos días de entreno
  // consecutivos. Un valor alto = un parón largo del que se volvió.
  const uniqueDayMs = [...new Set(dayKeys)].map(dayKeyToUtcMs).sort((a, b) => a - b)
  let longestGapDays = 0
  for (let i = 1; i < uniqueDayMs.length; i += 1) {
    const gap = (uniqueDayMs[i] - uniqueDayMs[i - 1]) / DAY
    if (gap > longestGapDays) longestGapDays = gap
  }

  // Semana con más partes del cuerpo distintas ("día de cuerpo completo" en 7 días).
  let maxBodyPartsInWeek = 0
  for (const parts of weekBodyParts.values()) {
    if (parts.size > maxBodyPartsInWeek) maxBodyPartsInWeek = parts.size
  }

  // Ventana deslizante de 30 días: para cada día con entreno, unimos las partes
  // de los días con entreno en [día-29, día] y guardamos el máximo. Solo hace
  // falta mirar días con sesión (fuera de ellos la ventana no gana partes), y
  // con un historial personal de cientos de días el O(N²) es despreciable.
  const dayParts = [...dayBodyParts]
    .map(([key, parts]) => ({ ms: dayKeyToUtcMs(key), parts }))
    .sort((a, b) => a.ms - b.ms)
  let maxBodyPartsIn30DayWindow = 0
  for (let i = 0; i < dayParts.length; i += 1) {
    const windowStart = dayParts[i].ms - 29 * DAY
    const union = new Set()
    for (let j = i; j >= 0 && dayParts[j].ms >= windowStart; j -= 1) {
      for (const bp of dayParts[j].parts) union.add(bp)
    }
    if (union.size > maxBodyPartsIn30DayWindow) maxBodyPartsIn30DayWindow = union.size
  }

  // Mes con más semanas ISO distintas entrenadas. Una semana que cruza dos
  // meses cuenta en ambos, porque cada mes la ve entera con sus sesiones.
  let maxDistinctWeeksInMonth = 0
  for (const weeks of monthWeeks.values()) {
    if (weeks.size > maxDistinctWeeksInMonth) maxDistinctWeeksInMonth = weeks.size
  }

  // Fin de semana completo: sábado (6) y domingo (0) en la misma semana ISO.
  let weekendPairs = 0
  for (const weekdays of weekWeekdays.values()) {
    if (weekdays.has(0) && weekdays.has(6)) weekendPairs += 1
  }

  // Semanas que superan el volumen de la inmediatamente anterior (lunes -7 días).
  // Si la anterior no tiene volumen registrado, no hay contra qué comparar.
  let beatPrevWeekVolume = 0
  for (const [weekStartMs, volume] of weekVolume) {
    const prev = weekVolume.get(weekStartMs - WEEK)
    if (prev !== undefined && volume > prev) beatPrevWeekVolume += 1
  }

  return {
    sessionCount: sessions.length,
    distinctBodyParts: bodyPartsAll.size,
    maxBodyPartsInWeek,
    distinctExercises: exercisesAll.size,
    maxBodyPartsIn30DayWindow,
    cardioSessions,
    maxDistinctWeeksInMonth,
    weekendPairs,
    beatPrevWeekVolume,
    prCount: countPersonalRecords(sessions),
    totalVolumeKg,
    totalReps,
    totalSets,
    maxSessionVolumeKg,
    maxSetsInSession,
    maxWeightSingleKg,
    maxStreak: maxConsecutiveDays(dayKeys),
    maxGoalWeekStreak: maxConsecutiveSteps(goalWeekMondays, WEEK),
    distinctActiveMonths: monthKeys.size,
    distinctActiveDays: new Set(dayKeys).size,
    maxDaysInWeek,
    longestGapDays,
    weekendSessions,
    earlyBirdSessions,
    nightOwlSessions,
    accountAgeDays: createdAt
      ? Math.max(0, Math.floor((now - new Date(createdAt)) / DAY))
      : 0,
  }
}

// ---------------------------------------------------------------------------
// Evaluación declarativa
// ---------------------------------------------------------------------------

/**
 * Métrica que mide cada tipo de regla. Un tipo desconocido (p.ej. earlyBird,
 * aún sin implementar) devuelve null: su insignia no se puede evaluar y se
 * queda bloqueada en silencio, en vez de romper la evaluación del resto.
 */
function metricForRuleType(type, metrics) {
  switch (type) {
    case 'streak':
      return metrics.maxStreak
    case 'sessionCount':
      return metrics.sessionCount
    case 'totalVolumeKg':
      return metrics.totalVolumeKg
    case 'totalReps':
      return metrics.totalReps
    case 'totalSets':
      return metrics.totalSets
    case 'maxSessionVolumeKg':
      return metrics.maxSessionVolumeKg
    case 'maxSetsInSession':
      return metrics.maxSetsInSession
    case 'maxWeightSingleKg':
      return metrics.maxWeightSingleKg
    case 'maxGoalWeekStreak':
      return metrics.maxGoalWeekStreak
    case 'distinctActiveMonths':
      return metrics.distinctActiveMonths
    case 'distinctActiveDays':
      return metrics.distinctActiveDays
    case 'maxDaysInWeek':
      return metrics.maxDaysInWeek
    case 'longestGapDays':
      return metrics.longestGapDays
    case 'weekendSessions':
      return metrics.weekendSessions
    case 'earlyBirdSessions':
      return metrics.earlyBirdSessions
    case 'nightOwlSessions':
      return metrics.nightOwlSessions
    case 'accountAgeDays':
      return metrics.accountAgeDays
    case 'distinctBodyParts':
      return metrics.distinctBodyParts
    case 'maxBodyPartsInWeek':
      return metrics.maxBodyPartsInWeek
    case 'distinctExercises':
      return metrics.distinctExercises
    case 'maxBodyPartsIn30DayWindow':
      return metrics.maxBodyPartsIn30DayWindow
    case 'cardioSessions':
      return metrics.cardioSessions
    case 'maxDistinctWeeksInMonth':
      return metrics.maxDistinctWeeksInMonth
    case 'weekendPairs':
      return metrics.weekendPairs
    case 'beatPrevWeekVolume':
      return metrics.beatPrevWeekVolume
    case 'prCount':
      return metrics.prCount
    default:
      return null
  }
}

function compare(operator, a, b) {
  switch (operator) {
    case 'gte':
      return a >= b
    case 'gt':
      return a > b
    case 'lte':
      return a <= b
    case 'lt':
      return a < b
    case 'eq':
      return a === b
    default:
      return false
  }
}

/**
 * Dadas las métricas y el catálogo, devuelve las insignias que el usuario
 * CUMPLE y todavía no tiene. `unlockedBadgeIds` es un Set de ids (string) ya
 * ganados, para no reofrecerlos.
 *
 * Devuelve `{ badge, metricValue }[]` — metricValue es el valor real que
 * disparó el desbloqueo, que se guarda como `progress` informativo.
 */
export function evaluateBadges(badges = [], metrics, unlockedBadgeIds = new Set()) {
  const unlocked = []
  for (const badge of badges) {
    if (unlockedBadgeIds.has(badge._id.toString())) continue
    const metricValue = metricForRuleType(badge.rule.type, metrics)
    if (metricValue == null) continue // tipo no soportado todavía
    if (compare(badge.rule.operator, metricValue, badge.rule.value)) {
      unlocked.push({ badge, metricValue })
    }
  }
  return unlocked
}

/**
 * Progreso de UNA insignia hacia su desbloqueo, para el muro: cuánto llevas
 * de lo que pide. `current` es la métrica actual, `target` el umbral de la
 * regla, `pct` el avance 0-100 (tope 100 aunque ya lo superes).
 *
 * Un tipo que el motor no mide todavía devuelve `current: null` y `pct: 0`:
 * la insignia se pinta bloqueada y sin barra, en vez de con un progreso falso.
 * `pct` asume reglas de acumulación (gte/gt), que son todas las de hoy; si un
 * día entra una regla "menor que", su barra necesitará otro cálculo.
 */
export function badgeProgress(badge, metrics) {
  const current = metricForRuleType(badge.rule.type, metrics)
  const target = badge.rule.value
  if (current == null) return { current: null, target, pct: 0 }
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return { current, target, pct }
}

// ---------------------------------------------------------------------------
// Servicio: leer, evaluar, persistir
// ---------------------------------------------------------------------------

/**
 * Evalúa todas las insignias de un usuario y persiste las recién desbloqueadas.
 *
 * Se llama en dos sitios: al cerrar una sesión (finishSession) y desde el
 * backfill para la historia existente. Es idempotente: lo ya ganado no se
 * reinserta (índice único {user, badge}); si una carrera cuela un duplicado,
 * el E11000 se ignora en vez de propagarse.
 *
 * Devuelve las insignias nuevas (documentos Badge) por si el caller quiere
 * mostrarlas — p.ej. el "recién desbloqueado" del muro.
 */
export async function evaluateAndPersist(userId) {
  const [sessions, badges, existing, user] = await Promise.all([
    // Solo sesiones cerradas: una sesión en curso no cuenta como entreno hecho
    // ni para el conteo ni para la racha. timeZone entra porque el día/semana
    // local de cada sesión se deriva de ella.
    // sort por startedAt: el conteo de récords depende del orden (cada mejora
    // se compara con la anterior). computeUserMetrics ordena por dentro igual,
    // así que este sort es explícito, no el único garante.
    Session.find({ user: userId, endedAt: { $ne: null } })
      .select(SESSION_METRIC_SELECT)
      .sort({ startedAt: 1 })
      .lean(),
    Badge.find().lean(),
    UserBadge.find({ user: userId }).select('badge').lean(),
    // weeklyGoal (umbral de semana cumplida) y createdAt (antigüedad) no viven
    // en las sesiones.
    User.findById(userId).select('weeklyGoal createdAt').lean(),
  ])

  const metrics = computeUserMetrics(sessions, {
    weeklyGoal: user?.weeklyGoal,
    createdAt: user?.createdAt,
  })
  const unlockedBadgeIds = new Set(existing.map((ub) => ub.badge.toString()))
  const newlyUnlocked = evaluateBadges(badges, metrics, unlockedBadgeIds)

  if (newlyUnlocked.length === 0) return []

  const now = new Date()
  const docs = newlyUnlocked.map(({ badge, metricValue }) => ({
    user: userId,
    badge: badge._id,
    unlockedAt: now,
    progress: metricValue,
  }))

  try {
    // ordered:false -> intenta todas; si una choca con el índice único por una
    // evaluación concurrente, las demás entran igual.
    await UserBadge.insertMany(docs, { ordered: false })
  } catch (err) {
    // E11000 = carrera perdida contra {user, badge}. No es un fallo del dominio:
    // la insignia ya estaba ganada. Cualquier otro error sí se propaga.
    if (err?.code !== 11000) throw err
  }

  return newlyUnlocked.map(({ badge }) => badge)
}
