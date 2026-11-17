// Badge engine: declarative rule evaluation

import Session from '../models/session.model.js'
import Badge from '../models/badge.model.js'
import UserBadge from '../models/userBadge.model.js'
import User from '../models/user.model.js'
import { MUSCLE_TO_BODY_PART } from '../models/constants.js'

/** Session fields the engine needs */
export const SESSION_METRIC_SELECT =
  'startedAt timeZone entries.exercise entries.muscle entries.tracking entries.sets.weightKg entries.sets.reps entries.sets.completed'

// Metrics derived from sessions

function localParts(dateLike, timeZone) {
  const d = new Date(dateLike)
  const fmt = (tz) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d)
  let parts
  try {
    parts = fmt(timeZone || 'UTC')
  } catch {
    parts = fmt('UTC')
  }
  const get = (t) => parts.find((p) => p.type === t).value
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  const hour = Number(get('hour'))

  const localUtc = new Date(Date.UTC(year, month - 1, day))
  const weekday = localUtc.getUTCDay()
  const mondayOffset = (weekday + 6) % 7
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

function countPersonalRecords(sessions) {
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.startedAt) - new Date(b.startedAt),
  )
  const bestByExercise = new Map()
  let prCount = 0

  for (const session of chronological) {
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

/** Turn closed sessions into the metrics the engine compares */
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
  const weekCounts = new Map()
  const weekDays = new Map()
  const bodyPartsAll = new Set()
  const exercisesAll = new Set()
  const weekBodyParts = new Map()
  const dayBodyParts = new Map()
  let cardioSessions = 0
  const monthWeeks = new Map()
  const weekWeekdays = new Map()
  const weekVolume = new Map()

  for (const s of sessions) {
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
    if (weekday === 0 || weekday === 6) weekendSessions += 1
    if (hour < 7) earlyBirdSessions += 1
    if (hour >= 22) nightOwlSessions += 1

    let sessionVolumeKg = 0
    let sessionSets = 0
    const sessionBodyParts = new Set()
    let sessionHasCardio = false

    for (const entry of s.entries ?? []) {
      let entryDone = false
      for (const set of entry.sets ?? []) {
        if (!set.completed) continue
        entryDone = true

        totalSets += 1
        sessionSets += 1

        const r = set.reps ?? 0
        if (r > 0) totalReps += r

        if (entry.tracking !== 'weight_reps') continue
        const w = set.weightKg ?? 0
        if (w > 0 && r > 0) {
          totalVolumeKg += w * r
          sessionVolumeKg += w * r
        }
        if (w > 0 && r > 0 && w > maxWeightSingleKg) maxWeightSingleKg = w
      }

      if (entryDone) {
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

  const goalWeekMondays = []
  for (const [weekStartMs, count] of weekCounts) {
    if (count >= weeklyGoal) goalWeekMondays.push(weekStartMs)
  }
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const DAY = 24 * 60 * 60 * 1000

  let maxDaysInWeek = 0
  for (const days of weekDays.values()) {
    if (days.size > maxDaysInWeek) maxDaysInWeek = days.size
  }

  const uniqueDayMs = [...new Set(dayKeys)].map(dayKeyToUtcMs).sort((a, b) => a - b)
  let longestGapDays = 0
  for (let i = 1; i < uniqueDayMs.length; i += 1) {
    const gap = (uniqueDayMs[i] - uniqueDayMs[i - 1]) / DAY
    if (gap > longestGapDays) longestGapDays = gap
  }

  let maxBodyPartsInWeek = 0
  for (const parts of weekBodyParts.values()) {
    if (parts.size > maxBodyPartsInWeek) maxBodyPartsInWeek = parts.size
  }

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

  let maxDistinctWeeksInMonth = 0
  for (const weeks of monthWeeks.values()) {
    if (weeks.size > maxDistinctWeeksInMonth) maxDistinctWeeksInMonth = weeks.size
  }

  let weekendPairs = 0
  for (const weekdays of weekWeekdays.values()) {
    if (weekdays.has(0) && weekdays.has(6)) weekendPairs += 1
  }

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

// Declarative evaluation

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

/** Badges the user qualifies for and has not unlocked yet */
export function evaluateBadges(badges = [], metrics, unlockedBadgeIds = new Set()) {
  const unlocked = []
  for (const badge of badges) {
    if (unlockedBadgeIds.has(badge._id.toString())) continue
    const metricValue = metricForRuleType(badge.rule.type, metrics)
    if (metricValue == null) continue
    if (compare(badge.rule.operator, metricValue, badge.rule.value)) {
      unlocked.push({ badge, metricValue })
    }
  }
  return unlocked
}

/** Progress of one badge toward unlocking, for the wall */
export function badgeProgress(badge, metrics) {
  const current = metricForRuleType(badge.rule.type, metrics)
  const target = badge.rule.value
  if (current == null) return { current: null, target, pct: 0 }
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return { current, target, pct }
}

// Service: read, evaluate, persist

/** Evaluate all badges for a user and persist new unlocks */
export async function evaluateAndPersist(userId) {
  const [sessions, badges, existing, user] = await Promise.all([
    Session.find({ user: userId, endedAt: { $ne: null } })
      .select(SESSION_METRIC_SELECT)
      .sort({ startedAt: 1 })
      .lean(),
    Badge.find().lean(),
    UserBadge.find({ user: userId }).select('badge').lean(),
    User.findById(userId).select('settings.weeklyGoal createdAt').lean(),
  ])

  const metrics = computeUserMetrics(sessions, {
    weeklyGoal: user?.settings?.weeklyGoal,
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
    await UserBadge.insertMany(docs, { ordered: false })
  } catch (err) {
    if (err?.code !== 11000) throw err
  }

  return newlyUnlocked.map(({ badge }) => badge)
}
