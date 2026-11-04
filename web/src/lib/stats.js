/*
  Agregados que el backend todavía no expone y que Home necesita. Cuando la
  Fase 2 publique endpoints de estadísticas estas funciones se van: hasta
  entonces viven aquí para no filtrar lógica dentro de los componentes.

  Convenciones:
  - Entradas siempre crudas tal como las devuelve la API (startedAt en ISO,
    weightKg en kg, duración en segundos). La capa de presentación convierte
    unidades, estas funciones no.
  - La semana empieza en lunes (locale ES/EN de gimnasio, no US domingo).
  - Las fechas se comparan por YYYY-MM-DD en horario local del dispositivo:
    si el usuario registra una sesión a las 23:50 cuenta ese día, no el
    siguiente.
*/

function toLocalDayKey(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfLocalDay(d) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfIsoWeek(d) {
  const r = startOfLocalDay(d)
  const day = r.getDay() // 0=sun … 6=sat
  const diff = day === 0 ? -6 : 1 - day
  return addDays(r, diff)
}

/*
  Racha = número máximo de días consecutivos con al menos una sesión que
  termina en "hoy" o "ayer". Si la última sesión fue hace más de un día la
  racha vale 0: así se evita el típico bug de "llevas 5 días" cuando llevas
  dos semanas sin entrenar.
*/
export function computeStreak(sessions, today = new Date()) {
  if (!sessions?.length) return 0
  const days = new Set(sessions.map((s) => toLocalDayKey(s.startedAt)))
  const todayKey = toLocalDayKey(today)
  const yesterdayKey = toLocalDayKey(addDays(today, -1))
  if (!days.has(todayKey) && !days.has(yesterdayKey)) return 0

  let cursor = days.has(todayKey) ? today : addDays(today, -1)
  let count = 0
  while (days.has(toLocalDayKey(cursor))) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

export function countThisWeek(sessions, today = new Date()) {
  if (!sessions?.length) return 0
  const monday = startOfIsoWeek(today)
  return sessions.filter((s) => new Date(s.startedAt) >= monday).length
}

// Epley: w × (1 + reps/30). Rápida y lo bastante buena para 1-10 reps, que
// es el rango útil para estimar un 1RM a partir del entreno real.
export function estimate1RM(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return 0
  return weightKg * (1 + reps / 30)
}

/*
  Recorre todas las series weight_reps de la sesión y devuelve el mejor 1RM
  estimado, con el nombre del ejercicio que lo produjo. Para una sesión sin
  pesos (solo cardio o isométricos) devuelve null.
*/
export function latest1RM(sessionDetail) {
  if (!sessionDetail?.entries?.length) return null
  let best = null
  for (const entry of sessionDetail.entries) {
    if (entry.tracking !== 'weight_reps') continue
    for (const set of entry.sets ?? []) {
      if (!set.completed && set.completed !== undefined) continue
      const kg = estimate1RM(set.weightKg, set.reps)
      if (!best || kg > best.kg) {
        // Guardamos también el id del ejercicio para que el Home pueda
        // aplicar el alias del usuario sin perder el fallback canónico.
        best = {
          exerciseName: entry.exerciseName,
          exerciseId:
            (entry.exercise && typeof entry.exercise === 'object'
              ? entry.exercise._id
              : entry.exercise) ?? null,
          kg,
        }
      }
    }
  }
  return best
}

/*
  Reparto 1-4 por INTENSIDAD (RIR + duración de cardio, ver sessionController
  getHeatmap y useHeatmap). Umbrales FIJOS sobre `cell.intensity ∈ [0, 1]`,
  no relativos al máximo de la ventana: una semana floja no debe repintar
  como verde fuerte solo porque nada más intenso existe.

  Fallback: si hay `count > 0` pero `intensity == null` (el usuario entrenó
  pero no anotó RIR en ninguna serie y tampoco hizo cardio), pintamos
  nivel 1 — "entrenaste, no sabemos cuánto". Nunca un cell vacío, nunca un
  nivel 4 silencioso.
*/
export function levelsFromCells(cells) {
  return cells.map((c) => {
    if (!c.count) return 0
    if (c.intensity == null) return 1
    if (c.intensity <= 0.4) return 1
    if (c.intensity <= 0.6) return 2
    if (c.intensity <= 0.8) return 3
    return 4
  })
}
