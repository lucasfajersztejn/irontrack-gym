import { describe, it, expect } from 'vitest'
import {
  barWeightFor,
  totalFromPerSide,
  perSideFromTotal,
  shouldShowPerSide,
  shouldShowBarWeightInput,
} from '../../src/lib/weight.js'

describe('barWeightFor', () => {
  it('is 0 when the exercise does not use a bar', () => {
    expect(barWeightFor({ usesBar: false, equipment: 'dumbbell' })).toBe(0)
    expect(barWeightFor(null)).toBe(0)
  })

  it('uses the per-entry override for barbells', () => {
    expect(barWeightFor({ usesBar: true, equipment: 'barbell' }, 15)).toBe(15)
  })

  it('ignores the override for fixed-bar equipment', () => {
    const smith = { usesBar: true, equipment: 'smith', defaultBarWeightKg: 15 }
    expect(barWeightFor(smith, 20)).toBe(15)
    expect(barWeightFor({ usesBar: true, equipment: 'ez-bar' }, 20)).toBe(0)
  })

  it('ignores a NaN override', () => {
    expect(barWeightFor({ usesBar: true, equipment: 'barbell' }, NaN, 20)).toBe(20)
  })

  it('falls back to the exercise default, then the user default', () => {
    expect(barWeightFor({ usesBar: true, equipment: 'barbell', defaultBarWeightKg: 10 })).toBe(10)
    expect(barWeightFor({ usesBar: true, equipment: 'barbell' }, null, 15)).toBe(15)
    expect(barWeightFor({ usesBar: true, equipment: 'barbell' })).toBe(20)
  })
})

describe('per-side conversions', () => {
  it('computes the total from per-side plates', () => {
    expect(totalFromPerSide(30, 20)).toBe(80)
    expect(totalFromPerSide(null, 20)).toBeNull()
  })

  it('computes per-side from the total', () => {
    expect(perSideFromTotal(80, 20)).toBe(30)
    expect(perSideFromTotal(null, 20)).toBeNull()
  })

  it('clamps per-side at 0 when the total is below the bar', () => {
    expect(perSideFromTotal(10, 20)).toBe(0)
  })

  it('round-trips', () => {
    expect(perSideFromTotal(totalFromPerSide(27.5, 20), 20)).toBe(27.5)
  })
})

describe('display helpers', () => {
  it('shows per-side only for bar exercises in plates mode', () => {
    expect(shouldShowPerSide({ usesBar: true }, 'plates')).toBe(true)
    expect(shouldShowPerSide({ usesBar: true }, 'total')).toBe(false)
    expect(shouldShowPerSide({ usesBar: false }, 'plates')).toBe(false)
    expect(shouldShowPerSide(undefined, 'plates')).toBe(false)
  })

  it('shows the bar input only for barbells', () => {
    expect(shouldShowBarWeightInput({ equipment: 'barbell' })).toBe(true)
    expect(shouldShowBarWeightInput({ equipment: 'smith' })).toBe(false)
    expect(shouldShowBarWeightInput(null)).toBe(false)
  })
})
