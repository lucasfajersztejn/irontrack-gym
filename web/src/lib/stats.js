// Pure stats helpers.

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
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(r, diff)
}

// Current day streak.
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

// Epley 1RM estimate: w * (1 + reps / 30).
export function estimate1RM(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return 0
  return weightKg * (1 + reps / 30)
}

// Latest estimated 1RM from a session detail.
export function latest1RM(sessionDetail) {
  if (!sessionDetail?.entries?.length) return null
  let best = null
  for (const entry of sessionDetail.entries) {
    if (entry.tracking !== 'weight_reps') continue
    for (const set of entry.sets ?? []) {
      if (!set.completed && set.completed !== undefined) continue
      const kg = estimate1RM(set.weightKg, set.reps)
      if (!best || kg > best.kg) {
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

// Map heatmap cells to intensity levels.
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
