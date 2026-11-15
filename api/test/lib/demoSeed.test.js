import { describe, it, expect } from 'vitest'
import {
  createRng,
  planSessionSchedule,
  buildSets,
  targetFieldsFor,
} from '../../src/scripts/seedDemoUser.js'

/*
  Funciones puras del seed: calendario y series. No tocan Mongo, así que se
  prueban sin base de datos. La prueba contra el modelo real (validación de
  Session) vive en routes/demo.test.js.
*/

const NOW = new Date('2026-11-15T12:00:00Z')

describe('calendario de la demo', () => {
  it('genera sesiones en orden cronológico y nunca en el futuro', () => {
    const schedule = planSessionSchedule(NOW)
    const times = schedule.map((s) => s.startedAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.every((t) => t <= NOW.getTime())).toBe(true)
  })

  it('cae en el rango de 40 a 60 sesiones pedido en la spec', () => {
    const { length } = planSessionSchedule(NOW)
    expect(length).toBeGreaterThanOrEqual(40)
    expect(length).toBeLessThanOrEqual(60)
  })

  it('deja un hueco de más de 14 días (para la medalla de vuelta tras parón)', () => {
    const times = planSessionSchedule(NOW).map((s) => s.startedAt.getTime())
    const longestGapDays = Math.max(
      ...times.slice(1).map((t, i) => (t - times[i]) / (24 * 60 * 60 * 1000)),
    )
    expect(longestGapDays).toBeGreaterThan(14)
  })

  it('rota las tres plantillas y es determinista con el mismo reloj', () => {
    const a = planSessionSchedule(NOW)
    const b = planSessionSchedule(NOW)
    expect(a.map((s) => s.startedAt.getTime())).toEqual(b.map((s) => s.startedAt.getTime()))
    expect(new Set(a.slice(0, 3).map((s) => s.routineIndex)).size).toBe(3)
  })
})

describe('series por tracking', () => {
  const item = { sets: 3, reps: 8, startKg: 60, gainKg: 7.5, startReps: 5, gainReps: 3, startSec: 45, gainSec: 15, startM: 2500, gainM: 500, durationSec: 1200 }
  const rng = () => createRng(7)

  it('weight_reps guarda peso y reps, en kg y en escalones de 2,5', () => {
    const sets = buildSets(item, 'weight_reps', 0.5, rng())
    expect(sets).toHaveLength(3)
    for (const set of sets) {
      expect(set.weightKg % 2.5).toBe(0)
      expect(set.reps).toBeGreaterThan(0)
      expect(set).not.toHaveProperty('durationSec')
      expect(set).not.toHaveProperty('distanceM')
    }
  })

  it('reps guarda solo reps (sin peso de serie)', () => {
    const sets = buildSets(item, 'reps', 0.5, rng())
    for (const set of sets) {
      expect(set.reps).toBeGreaterThan(0)
      expect(set).not.toHaveProperty('weightKg')
    }
  })

  it('time guarda solo durationSec', () => {
    const sets = buildSets(item, 'time', 0.5, rng())
    for (const set of sets) {
      expect(set.durationSec).toBeGreaterThan(0)
      expect(set).not.toHaveProperty('reps')
      expect(set).not.toHaveProperty('weightKg')
    }
  })

  it('distance_time guarda distanceM y durationSec', () => {
    const sets = buildSets(item, 'distance_time', 0.5, rng())
    for (const set of sets) {
      expect(set.distanceM % 50).toBe(0)
      expect(set.durationSec).toBeGreaterThan(0)
      expect(set).not.toHaveProperty('weightKg')
    }
  })

  it('un tracking desconocido falla en vez de inventar campos', () => {
    expect(() => buildSets(item, 'peso_x_reps', 0, rng())).toThrow(/Tracking desconocido/)
    expect(() => targetFieldsFor(item, 'peso_x_reps')).toThrow(/Tracking desconocido/)
  })

  it('la progresión sube el peso entre la primera y la última sesión', () => {
    const first = buildSets(item, 'weight_reps', 0, createRng(1))[0].weightKg
    const last = buildSets(item, 'weight_reps', 1, createRng(1))[0].weightKg
    expect(last).toBeGreaterThan(first)
  })
})
