import { describe, it, expect } from 'vitest'
import {
  computeStreak,
  countThisWeek,
  estimate1RM,
  latest1RM,
  levelsFromCells,
} from '../../src/lib/stats.js'

const at = (y, m, d, h = 10) => ({ startedAt: new Date(y, m, d, h).toISOString() })
const today = new Date(2026, 4, 13, 12)

describe('computeStreak', () => {
  it('is 0 without sessions', () => {
    expect(computeStreak([], today)).toBe(0)
    expect(computeStreak(undefined, today)).toBe(0)
  })

  it('counts consecutive days ending today', () => {
    expect(computeStreak([at(2026, 4, 13), at(2026, 4, 12), at(2026, 4, 11)], today)).toBe(3)
  })

  it('keeps the streak alive when the last session was yesterday', () => {
    expect(computeStreak([at(2026, 4, 12), at(2026, 4, 11)], today)).toBe(2)
  })

  it('is 0 when the last session was two days ago', () => {
    expect(computeStreak([at(2026, 4, 11)], today)).toBe(0)
  })

  it('stops at a gap', () => {
    expect(computeStreak([at(2026, 4, 13), at(2026, 4, 11)], today)).toBe(1)
  })

  it('counts several sessions on one day once', () => {
    expect(computeStreak([at(2026, 4, 13, 8), at(2026, 4, 13, 19)], today)).toBe(1)
  })

  it('crosses a month and year boundary', () => {
    const t = new Date(2026, 0, 1, 12)
    expect(computeStreak([at(2026, 0, 1), at(2025, 11, 31), at(2025, 11, 30)], t)).toBe(3)
  })
})

describe('countThisWeek', () => {
  it('is 0 without sessions', () => {
    expect(countThisWeek([], today)).toBe(0)
  })

  it('counts from Monday of the current week', () => {
    const sessions = [at(2026, 4, 11), at(2026, 4, 10), at(2026, 4, 13)]
    expect(countThisWeek(sessions, today)).toBe(2)
  })

  it('treats Sunday as the end of the week', () => {
    const sunday = new Date(2026, 4, 17, 12)
    expect(countThisWeek([at(2026, 4, 11), at(2026, 4, 10)], sunday)).toBe(1)
  })
})

describe('estimate1RM', () => {
  it('applies Epley', () => {
    expect(estimate1RM(100, 3)).toBeCloseTo(110)
    expect(estimate1RM(60, 10)).toBeCloseTo(80)
  })

  it('adds the Epley term even for a single rep', () => {
    expect(estimate1RM(90, 1)).toBeCloseTo(93)
  })

  it('returns 0 for missing or invalid input', () => {
    expect(estimate1RM(0, 5)).toBe(0)
    expect(estimate1RM(100, 0)).toBe(0)
    expect(estimate1RM(null, 5)).toBe(0)
    expect(estimate1RM(100, undefined)).toBe(0)
  })
})

describe('latest1RM', () => {
  it('returns null for empty detail', () => {
    expect(latest1RM(null)).toBeNull()
    expect(latest1RM({ entries: [] })).toBeNull()
  })

  it('picks the best set across entries', () => {
    const detail = {
      entries: [
        { tracking: 'weight_reps', exerciseName: 'Bench', exercise: 'b1', sets: [{ weightKg: 80, reps: 5 }] },
        { tracking: 'weight_reps', exerciseName: 'Squat', exercise: { _id: 's1' }, sets: [{ weightKg: 120, reps: 5 }] },
      ],
    }
    const best = latest1RM(detail)
    expect(best.exerciseName).toBe('Squat')
    expect(best.exerciseId).toBe('s1')
    expect(best.kg).toBeCloseTo(140)
  })

  it('ignores non weight_reps entries', () => {
    const detail = {
      entries: [{ tracking: 'time', exerciseName: 'Plank', sets: [{ weightKg: 100, reps: 10 }] }],
    }
    expect(latest1RM(detail)).toBeNull()
  })

  it('skips sets explicitly not completed', () => {
    const detail = {
      entries: [
        {
          tracking: 'weight_reps',
          exerciseName: 'Bench',
          exercise: 'b1',
          sets: [
            { weightKg: 200, reps: 5, completed: false },
            { weightKg: 80, reps: 5, completed: true },
          ],
        },
      ],
    }
    expect(latest1RM(detail).kg).toBeCloseTo(80 * (1 + 5 / 30))
  })

  it('sets exerciseId to null when the exercise is missing', () => {
    const detail = {
      entries: [{ tracking: 'weight_reps', exerciseName: 'X', sets: [{ weightKg: 50, reps: 5 }] }],
    }
    expect(latest1RM(detail).exerciseId).toBeNull()
  })
})

describe('levelsFromCells', () => {
  it('maps count and intensity to levels', () => {
    const cells = [
      { count: 0, intensity: null },
      { count: 1, intensity: null },
      { count: 1, intensity: 0.4 },
      { count: 1, intensity: 0.5 },
      { count: 1, intensity: 0.8 },
      { count: 1, intensity: 0.95 },
    ]
    expect(levelsFromCells(cells)).toEqual([0, 1, 1, 2, 3, 4])
  })
})
