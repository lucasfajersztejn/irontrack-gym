import { describe, it, expect } from 'vitest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'
import Badge from '../../src/models/badge.model.js'
import UserBadge from '../../src/models/userBadge.model.js'
import {
  computeUserMetrics,
  evaluateBadges,
  evaluateAndPersist,
} from '../../src/lib/badgeEngine.js'

/**
 * El motor de insignias es el corazón de la Fase 3. Se testea en dos niveles:
 * las funciones puras sin Mongo (métricas y evaluación declarativa) y el
 * servicio que persiste, con la base en memoria de la suite.
 */

function session({ day, sets }) {
  // Fecha en UTC explícita para que la clave de día no dependa de la zona de
  // la máquina que corre el test.
  const startedAt = new Date(`2026-01-${String(day).padStart(2, '0')}T10:00:00Z`)
  return {
    startedAt,
    entries: [
      {
        tracking: 'weight_reps',
        sets: sets.map((s, i) => ({ order: i, completed: true, ...s })),
      },
    ],
  }
}

describe('computeUserMetrics', () => {
  it('cuenta sesiones, suma volumen y mide la racha máxima', () => {
    const sessions = [
      session({ day: 1, sets: [{ weightKg: 100, reps: 5 }] }), // 500
      session({ day: 2, sets: [{ weightKg: 80, reps: 10 }] }), // 800
      session({ day: 3, sets: [{ weightKg: 60, reps: 5 }] }), // 300
      // hueco en el día 4-5
      session({ day: 6, sets: [{ weightKg: 50, reps: 5 }] }), // 250
    ]
    const m = computeUserMetrics(sessions)
    expect(m.sessionCount).toBe(4)
    expect(m.totalVolumeKg).toBe(1850)
    expect(m.maxStreak).toBe(3) // días 1-2-3
  })

  it('ignora series sin completar o de otro tracking para el volumen', () => {
    const sessions = [
      {
        startedAt: new Date('2026-02-01T10:00:00Z'),
        entries: [
          {
            tracking: 'weight_reps',
            sets: [
              { order: 0, completed: true, weightKg: 100, reps: 5 }, // 500
              { order: 1, completed: false, weightKg: 100, reps: 5 }, // ignorada
            ],
          },
          {
            tracking: 'time',
            sets: [{ order: 0, completed: true, durationSec: 60 }], // no suma volumen
          },
        ],
      },
    ]
    const m = computeUserMetrics(sessions)
    expect(m.totalVolumeKg).toBe(500)
    expect(m.sessionCount).toBe(1)
    expect(m.maxStreak).toBe(1)
  })
})

describe('evaluateBadges', () => {
  const metrics = { maxStreak: 7, sessionCount: 12, totalVolumeKg: 15000 }

  function badge(rule, id = new mongoose.Types.ObjectId()) {
    return { _id: id, rule }
  }

  it('desbloquea solo las reglas cumplidas', () => {
    const badges = [
      badge({ type: 'streak', operator: 'gte', value: 7 }), // ✓ 7>=7
      badge({ type: 'streak', operator: 'gte', value: 30 }), // ✗
      badge({ type: 'sessionCount', operator: 'gte', value: 10 }), // ✓
      badge({ type: 'totalVolumeKg', operator: 'gte', value: 100000 }), // ✗
    ]
    const unlocked = evaluateBadges(badges, metrics)
    expect(unlocked).toHaveLength(2)
  })

  it('no reofrece una insignia ya ganada', () => {
    const won = new mongoose.Types.ObjectId()
    const badges = [badge({ type: 'streak', operator: 'gte', value: 7 }, won)]
    const unlocked = evaluateBadges(badges, metrics, new Set([won.toString()]))
    expect(unlocked).toHaveLength(0)
  })

  it('ignora un tipo de regla que el motor aún no sabe medir', () => {
    const badges = [badge({ type: 'earlyBird', operator: 'lt', value: 7 })]
    const unlocked = evaluateBadges(badges, metrics)
    expect(unlocked).toHaveLength(0)
  })

  it('guarda el valor real que disparó el desbloqueo', () => {
    const badges = [badge({ type: 'streak', operator: 'gte', value: 7 })]
    const [first] = evaluateBadges(badges, metrics)
    expect(first.metricValue).toBe(7)
  })
})

describe('evaluateAndPersist', () => {
  const user = new mongoose.Types.ObjectId()

  async function seedSmallBadges() {
    await Badge.create([
      {
        slug: 'streak-2',
        name: { es: 'Dos', en: 'Two' },
        description: { es: 'Dos días', en: 'Two days' },
        category: 'constancia',
        tier: 'bronce',
        rule: { type: 'streak', operator: 'gte', value: 2 },
      },
      {
        slug: 'sessions-2',
        name: { es: 'Dos sesiones', en: 'Two sessions' },
        description: { es: 'Dos sesiones', en: 'Two sessions' },
        category: 'hitos',
        tier: 'bronce',
        rule: { type: 'sessionCount', operator: 'gte', value: 2 },
      },
      {
        slug: 'streak-5',
        name: { es: 'Cinco', en: 'Five' },
        description: { es: 'Cinco días', en: 'Five days' },
        category: 'constancia',
        tier: 'plata',
        rule: { type: 'streak', operator: 'gte', value: 5 },
      },
    ])
  }

  async function createClosedSession(day) {
    const startedAt = new Date(`2026-03-${String(day).padStart(2, '0')}T10:00:00Z`)
    await Session.create({
      user,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 3_600_000),
      entries: [
        {
          exercise: new mongoose.Types.ObjectId(),
          exerciseName: 'Press banca',
          muscle: 'pectorals',
          tracking: 'weight_reps',
          order: 0,
          sets: [{ order: 0, completed: true, weightKg: 100, reps: 5 }],
        },
      ],
    })
  }

  it('persiste los desbloqueos y es idempotente', async () => {
    await seedSmallBadges()
    await createClosedSession(1)
    await createClosedSession(2) // racha de 2, 2 sesiones

    const first = await evaluateAndPersist(user)
    expect(first.map((b) => b.slug).sort()).toEqual(['sessions-2', 'streak-2'])
    expect(await UserBadge.countDocuments({ user })).toBe(2)

    // Segunda pasada sin cambios: nada nuevo, sin duplicar.
    const second = await evaluateAndPersist(user)
    expect(second).toHaveLength(0)
    expect(await UserBadge.countDocuments({ user })).toBe(2)
  })

  it('no cuenta la sesión en curso (sin endedAt)', async () => {
    await seedSmallBadges()
    await createClosedSession(1)
    // Sesión abierta: no debe contar para sessionCount ni racha.
    await Session.create({
      user,
      startedAt: new Date('2026-03-02T10:00:00Z'),
      endedAt: null,
      entries: [
        {
          exercise: new mongoose.Types.ObjectId(),
          exerciseName: 'Press banca',
          muscle: 'pectorals',
          tracking: 'weight_reps',
          order: 0,
          sets: [{ order: 0, completed: true, weightKg: 100, reps: 5 }],
        },
      ],
    })

    const unlocked = await evaluateAndPersist(user)
    // Solo 1 sesión cerrada -> ni streak-2 ni sessions-2.
    expect(unlocked).toHaveLength(0)
  })
})
