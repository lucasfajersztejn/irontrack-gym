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
        best = { exerciseName: entry.exerciseName, kg }
      }
    }
  }
  return best
}

/*
  Buckets diarios para el heatmap. La ventana se ancla a la semana ISO:
  termina el domingo de ESTA semana y empieza el lunes 12 semanas antes.
  Así la primera columna del heatmap siempre arranca en lunes (como GitHub)
  y el "esta semana vs. la anterior" se lee comparando columnas vecinas.

  Los días futuros dentro de la semana actual se marcan isFuture=true para
  que el render pueda pintarlos como celda vacía sin confundirlos con días
  sin entreno.
*/
export function bucketHeatmap(sessions, weeks = 12, today = new Date()) {
  const localToday = startOfLocalDay(today)
  const dayFromMon = (localToday.getDay() + 6) % 7 // 0 = lunes … 6 = domingo
  const end = addDays(localToday, 6 - dayFromMon)
  const totalDays = weeks * 7
  const start = addDays(end, -(totalDays - 1))

  const counts = new Map()
  for (const s of sessions ?? []) {
    const key = toLocalDayKey(s.startedAt)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const todayKey = toLocalDayKey(localToday)
  const cells = []
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i)
    const key = toLocalDayKey(d)
    const isFuture = d > localToday
    cells.push({
      date: key,
      count: counts.get(key) ?? 0,
      isFuture,
      isToday: key === todayKey,
    })
  }
  return cells
}

// Reparto 1-4 por intensidad relativa. Se usa el máximo real de la ventana
// para que una semana pico de 2 sesiones/día no se chafe contra el techo
// teórico y para que un principiante vea verde con pocas sesiones.
export function levelsFromCells(cells) {
  const max = cells.reduce((m, c) => (c.count > m ? c.count : m), 0)
  if (max === 0) return cells.map(() => 0)
  return cells.map((c) => {
    if (c.count === 0) return 0
    const r = c.count / max
    if (r <= 0.25) return 1
    if (r <= 0.5) return 2
    if (r <= 0.75) return 3
    return 4
  })
}
