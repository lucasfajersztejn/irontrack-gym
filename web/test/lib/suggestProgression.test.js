import { describe, it, expect } from 'vitest'
import {
  suggestFirstSetOfDay,
  suggestNextSetInSession,
  suggestDeload,
} from '../../src/lib/suggestProgression.js'

describe('suggestFirstSetOfDay', () => {
  it('adds one step to the last first set', () => {
    expect(suggestFirstSetOfDay({ firstSetLastTime: { weightKg: 60, reps: 8 } })).toEqual({
      weightKg: 62.5,
      reps: 8,
    })
  })

  it('snaps to the 2.5 kg grid', () => {
    expect(suggestFirstSetOfDay({ firstSetLastTime: { weightKg: 61, reps: 8 } }).weightKg).toBe(62.5)
  })

  it('falls back to the planned set', () => {
    expect(suggestFirstSetOfDay({ plannedSet: { weightKg: 40, reps: 10 } })).toEqual({
      weightKg: 40,
      reps: 10,
    })
  })

  it('prefers history over the plan', () => {
    const r = suggestFirstSetOfDay({
      firstSetLastTime: { weightKg: 50 },
      plannedSet: { weightKg: 40 },
    })
    expect(r).toEqual({ weightKg: 52.5, reps: null })
  })

  it('returns null without data', () => {
    expect(suggestFirstSetOfDay()).toBeNull()
    expect(suggestFirstSetOfDay({})).toBeNull()
  })
})

describe('suggestNextSetInSession', () => {
  it('returns null without a last set weight', () => {
    expect(suggestNextSetInSession()).toBeNull()
    expect(suggestNextSetInSession({ lastSet: { reps: 5 } })).toBeNull()
  })

  it('repeats the set at RIR 0 or missing', () => {
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 5, rir: 0 } })).toEqual({
      weightKg: 80,
      reps: 5,
    })
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 5 } })).toEqual({
      weightKg: 80,
      reps: 5,
    })
  })

  it('takes a small step with a small rep cut at RIR 1-2', () => {
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 10, rir: 2 } })).toEqual({
      weightKg: 82.5,
      reps: 8,
    })
  })

  it('takes a big step with halved reps at RIR 3 or more', () => {
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 10, rir: 3 } })).toEqual({
      weightKg: 85,
      reps: 5,
    })
  })

  it('never suggests fewer than 1 rep', () => {
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 2, rir: 3 } }).reps).toBe(1)
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, reps: 1, rir: 1 } }).reps).toBe(1)
  })

  it('keeps reps null when unknown', () => {
    expect(suggestNextSetInSession({ lastSet: { weightKg: 80, rir: 2 } }).reps).toBeNull()
  })
})

describe('suggestDeload', () => {
  it('drops about 10% snapped to 2.5 kg', () => {
    expect(suggestDeload({ peakKg: 100 })).toBe(90)
    expect(suggestDeload({ peakKg: 82.5 })).toBe(75)
  })

  it('always lowers the weight for light peaks', () => {
    expect(suggestDeload({ peakKg: 10 })).toBe(7.5)
    expect(suggestDeload({ peakKg: 5 })).toBeLessThan(5)
  })

  it('returns null for missing or non-positive peaks', () => {
    expect(suggestDeload()).toBeNull()
    expect(suggestDeload({ peakKg: 0 })).toBeNull()
    expect(suggestDeload({ peakKg: -5 })).toBeNull()
  })
})
