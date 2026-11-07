import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'

/**
 * Cubre la invariante #7 de CLAUDE.md: cada tracking define los campos
 * obligatorios de sus series. El pre('validate') del modelo es la única barrera
 * que impide meter un set de cardio sin durationSec o uno de fuerza sin reps.
 *
 * El test usa un ObjectId "flotante" para `entry.exercise`: Mongoose por
 * defecto no verifica la existencia del referenciado, así que podemos probar
 * la validación sin crear primero un Exercise del catálogo.
 */
function baseSession(entryOverride = {}) {
  return new Session({
    user: new mongoose.Types.ObjectId(),
    startedAt: new Date('2026-01-01T10:00:00Z'),
    entries: [{
      exercise: new mongoose.Types.ObjectId(),
      exerciseName: 'Press banca',
      muscle: 'pectorals',
      tracking: 'weight_reps',
      order: 0,
      sets: [{ order: 0, weightKg: 80, reps: 8 }],
      ...entryOverride,
    }],
  })
}

describe('Session model — validación cruzada por tracking', () => {
  it('weight_reps sin weightKg falla', async () => {
    const s = baseSession({ sets: [{ order: 0, reps: 8 }] })
    await expect(s.validate()).rejects.toThrow(/weightKg/)
  })

  it('weight_reps sin reps falla', async () => {
    const s = baseSession({ sets: [{ order: 0, weightKg: 80 }] })
    await expect(s.validate()).rejects.toThrow(/reps/)
  })

  it('time sin durationSec falla', async () => {
    const s = baseSession({ tracking: 'time', sets: [{ order: 0 }] })
    await expect(s.validate()).rejects.toThrow(/durationSec/)
  })

  it('distance_time sin distanceM falla', async () => {
    const s = baseSession({
      tracking: 'distance_time',
      sets: [{ order: 0, durationSec: 600 }],
    })
    await expect(s.validate()).rejects.toThrow(/distanceM/)
  })

  it('distance_time completo pasa', async () => {
    const s = baseSession({
      tracking: 'distance_time',
      sets: [{ order: 0, durationSec: 600, distanceM: 2000 }],
    })
    await expect(s.validate()).resolves.toBeUndefined()
  })

  it('reps con addedWeightKg pasa (dominadas con cinturón)', async () => {
    const s = baseSession({
      tracking: 'reps',
      sets: [{ order: 0, reps: 10, addedWeightKg: 15 }],
    })
    await expect(s.validate()).resolves.toBeUndefined()
  })
})

describe('Session model — coherencia temporal', () => {
  it('endedAt anterior a startedAt falla', async () => {
    const s = new Session({
      user: new mongoose.Types.ObjectId(),
      startedAt: new Date('2026-01-01T10:00:00Z'),
      endedAt:   new Date('2026-01-01T09:00:00Z'),
    })
    await expect(s.validate()).rejects.toThrow(/endedAt/)
  })

  it('durationSec virtual es null mientras la sesión esté abierta', () => {
    const s = new Session({
      user: new mongoose.Types.ObjectId(),
      startedAt: new Date(),
    })
    expect(s.durationSec).toBeNull()
  })

  it('durationSec virtual calcula segundos cuando hay cierre', () => {
    const start = new Date('2026-01-01T10:00:00Z')
    const end   = new Date('2026-01-01T11:00:00Z')
    const s = new Session({
      user: new mongoose.Types.ObjectId(),
      startedAt: start,
      endedAt: end,
    })
    expect(s.durationSec).toBe(3600)
  })
})
