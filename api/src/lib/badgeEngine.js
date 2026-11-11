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

// ---------------------------------------------------------------------------
// Métricas derivadas de las sesiones
// ---------------------------------------------------------------------------

/**
 * Clave de día en UTC (YYYY-MM-DD). La racha se mide sobre días naturales y,
 * sin zona horaria del usuario guardada, UTC es la referencia determinista.
 * Una sesión a las 23:30 hora local junto a otra a las 00:30 podría caer en el
 * mismo día UTC o en días distintos; para una racha de 7/30/100 días el margen
 * es irrelevante, y es coherente con no inventar una zona que no tenemos.
 */
function toUtcDayKey(dateLike) {
  const d = new Date(dateLike)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`
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
 * Convierte las sesiones cerradas en las métricas que el motor compara.
 * Entrada: documentos de sesión (lean) con startedAt y entries[].sets[].
 * Solo cuentan las series `completed` con peso y reps > 0 para el volumen,
 * mismo criterio que el resto de agregaciones (una serie a medio escribir no
 * mueve nada).
 */
export function computeUserMetrics(sessions = []) {
  let totalVolumeKg = 0
  let totalReps = 0
  let totalSets = 0
  let maxSessionVolumeKg = 0
  let maxSetsInSession = 0
  let maxWeightSingleKg = 0
  const dayKeys = []

  for (const s of sessions) {
    dayKeys.push(toUtcDayKey(s.startedAt))

    // Acumuladores POR sesión, para derivar los máximos "en una sola sesión"
    // sin un segundo recorrido. El volumen de sesión usa el mismo criterio que
    // el total (solo weight_reps completadas con peso y reps > 0).
    let sessionVolumeKg = 0
    let sessionSets = 0

    for (const entry of s.entries ?? []) {
      for (const set of entry.sets ?? []) {
        if (!set.completed) continue

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
    }

    if (sessionVolumeKg > maxSessionVolumeKg) maxSessionVolumeKg = sessionVolumeKg
    if (sessionSets > maxSetsInSession) maxSetsInSession = sessionSets
  }

  return {
    sessionCount: sessions.length,
    totalVolumeKg,
    totalReps,
    totalSets,
    maxSessionVolumeKg,
    maxSetsInSession,
    maxWeightSingleKg,
    maxStreak: maxConsecutiveDays(dayKeys),
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
  const [sessions, badges, existing] = await Promise.all([
    // Solo sesiones cerradas: una sesión en curso no cuenta como entreno hecho
    // ni para el conteo ni para la racha.
    Session.find({ user: userId, endedAt: { $ne: null } })
      .select('startedAt entries.tracking entries.sets.weightKg entries.sets.reps entries.sets.completed')
      .lean(),
    Badge.find().lean(),
    UserBadge.find({ user: userId }).select('badge').lean(),
  ])

  const metrics = computeUserMetrics(sessions)
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
