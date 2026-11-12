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
import { MUSCLES, BODY_PARTS, MUSCLE_TO_BODY_PART } from '../../src/models/constants.js'

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

  it('deriva reps, series y máximos por sesión', () => {
    const sessions = [
      {
        startedAt: new Date('2026-04-01T10:00:00Z'),
        entries: [
          {
            tracking: 'weight_reps',
            sets: [
              { order: 0, completed: true, weightKg: 100, reps: 5 }, // vol 500
              { order: 1, completed: true, weightKg: 120, reps: 3 }, // vol 360, peso récord
              { order: 2, completed: false, weightKg: 200, reps: 1 }, // sin completar: nada
            ],
          },
          {
            tracking: 'time',
            sets: [{ order: 0, completed: true, durationSec: 60 }], // serie sí, reps/peso no
          },
        ],
      },
      {
        startedAt: new Date('2026-04-02T10:00:00Z'),
        entries: [
          {
            tracking: 'weight_reps',
            sets: [{ order: 0, completed: true, weightKg: 50, reps: 10 }], // vol 500
          },
        ],
      },
    ]
    const m = computeUserMetrics(sessions)
    expect(m.totalReps).toBe(18) // 5 + 3 + 10 (la serie de tiempo no aporta reps)
    expect(m.totalSets).toBe(4) // 2 weight_reps + 1 time + 1 weight_reps (la no completada no)
    expect(m.maxSessionVolumeKg).toBe(860) // sesión 1: 500 + 360
    expect(m.maxSetsInSession).toBe(3) // sesión 1: 2 weight_reps completadas + 1 time
    expect(m.maxWeightSingleKg).toBe(120)
  })
})

describe('computeUserMetrics — calendario consciente de zona', () => {
  const BA = 'America/Argentina/Buenos_Aires' // UTC-3, sin DST

  function s(startedAt, timeZone) {
    return { startedAt: new Date(startedAt), timeZone, entries: [] }
  }

  it('el día lo decide la zona local, no UTC (racha)', () => {
    // Las dos caen el 1 de enero en UTC, pero en Buenos Aires la primera fue el
    // 31 de diciembre a las 23:00. Local => dos días consecutivos => racha 2.
    const sessions = [
      s('2026-01-01T02:00:00Z', BA), // local 2025-12-31
      s('2026-01-01T12:00:00Z', BA), // local 2026-01-01
    ]
    expect(computeUserMetrics(sessions).maxStreak).toBe(2)
  })

  it('cuenta fin de semana por el día LOCAL', () => {
    const sessions = [
      s('2026-01-10T12:00:00Z', 'UTC'), // sábado en UTC -> cuenta
      s('2026-01-10T02:00:00Z', BA), // local viernes 23:00 -> NO cuenta
    ]
    expect(computeUserMetrics(sessions).weekendSessions).toBe(1)
  })

  it('mide semanas CONSECUTIVAS que cumplen la meta', () => {
    const sessions = [
      // Semana A (lun 05 / mar 06 ene): 2 sesiones
      s('2026-01-05T10:00:00Z', 'UTC'),
      s('2026-01-06T10:00:00Z', 'UTC'),
      // Semana B (lun 12 / mar 13 ene): 2 sesiones -> consecutiva con A
      s('2026-01-12T10:00:00Z', 'UTC'),
      s('2026-01-13T10:00:00Z', 'UTC'),
      // Semana D (lun 26 / mar 27 ene): 2 sesiones, pero se saltó la semana C
      s('2026-01-26T10:00:00Z', 'UTC'),
      s('2026-01-27T10:00:00Z', 'UTC'),
    ]
    const m = computeUserMetrics(sessions, { weeklyGoal: 2 })
    expect(m.maxGoalWeekStreak).toBe(2) // A-B seguidas; D rompe
  })

  it('una semana por debajo de la meta no cuenta', () => {
    const sessions = [s('2026-01-05T10:00:00Z', 'UTC')] // 1 sesión
    expect(computeUserMetrics(sessions, { weeklyGoal: 2 }).maxGoalWeekStreak).toBe(0)
  })

  it('cuenta meses naturales distintos', () => {
    const sessions = [
      s('2026-01-10T10:00:00Z', 'UTC'),
      s('2026-01-20T10:00:00Z', 'UTC'), // mismo mes
      s('2026-02-02T10:00:00Z', 'UTC'),
    ]
    expect(computeUserMetrics(sessions).distinctActiveMonths).toBe(2)
  })

  it('deriva la antigüedad de la cuenta en días', () => {
    const m = computeUserMetrics([], {
      createdAt: new Date('2025-01-01T00:00:00Z'),
      now: new Date('2026-01-01T00:00:00Z'),
    })
    expect(m.accountAgeDays).toBe(365)
  })

  it('sin timeZone cae a UTC sin romper', () => {
    const sessions = [{ startedAt: new Date('2026-03-01T10:00:00Z'), entries: [] }]
    const m = computeUserMetrics(sessions)
    expect(m.sessionCount).toBe(1)
    expect(m.distinctActiveMonths).toBe(1)
  })
})

describe('computeUserMetrics — hora local y heatmap (Wave 3)', () => {
  const BA = 'America/Argentina/Buenos_Aires' // UTC-3

  function s(startedAt, timeZone) {
    return { startedAt: new Date(startedAt), timeZone, entries: [] }
  }

  it('clasifica madrugada y noche por la hora LOCAL', () => {
    const sessions = [
      s('2026-01-05T09:00:00Z', BA), // local 06:00 -> madrugada
      s('2026-01-05T01:00:00Z', BA), // local 22:00 del día anterior -> noche
      s('2026-01-05T18:00:00Z', BA), // local 15:00 -> ninguna
    ]
    const m = computeUserMetrics(sessions)
    expect(m.earlyBirdSessions).toBe(1)
    expect(m.nightOwlSessions).toBe(1)
  })

  it('cuenta días distintos con sesión (contribución)', () => {
    const sessions = [
      s('2026-02-01T10:00:00Z', 'UTC'),
      s('2026-02-01T20:00:00Z', 'UTC'), // mismo día
      s('2026-02-02T10:00:00Z', 'UTC'),
    ]
    expect(computeUserMetrics(sessions).distinctActiveDays).toBe(2)
  })

  it('detecta la semana completa (7 días distintos)', () => {
    // Semana ISO de lun 05 a dom 11 de enero 2026, un día cada uno.
    const sessions = [5, 6, 7, 8, 9, 10, 11].map((day) =>
      s(`2026-01-${String(day).padStart(2, '0')}T10:00:00Z`, 'UTC'),
    )
    expect(computeUserMetrics(sessions).maxDaysInWeek).toBe(7)
  })

  it('mide el mayor hueco entre sesiones (vuelta al ruedo)', () => {
    const sessions = [
      s('2026-01-01T10:00:00Z', 'UTC'),
      s('2026-02-01T10:00:00Z', 'UTC'), // 31 días después
    ]
    expect(computeUserMetrics(sessions).longestGapDays).toBe(31)
  })
})

describe('computeUserMetrics — variedad (Wave 5)', () => {
  // Entrada denormalizada tal como la guarda Session: exercise + muscle + tracking.
  function entry({ exercise, muscle, completed = true }) {
    return {
      exercise,
      muscle,
      tracking: 'weight_reps',
      sets: [{ order: 0, completed, weightKg: 50, reps: 5 }],
    }
  }
  function trained(startedAt, entries) {
    return { startedAt: new Date(startedAt), timeZone: 'UTC', entries }
  }

  it('mapea cada músculo del catálogo a una parte del cuerpo válida', () => {
    for (const muscle of MUSCLES) {
      expect(BODY_PARTS).toContain(MUSCLE_TO_BODY_PART[muscle])
    }
    expect(MUSCLE_TO_BODY_PART.pectorals).toBe('chest')
    expect(MUSCLE_TO_BODY_PART.cardio).toBe('cardio')
  })

  it('cuenta partes del cuerpo distintas, sin repetir y sin entries vacías', () => {
    const sessions = [
      trained('2026-01-05T10:00:00Z', [entry({ exercise: 'a', muscle: 'pectorals' })]),
      trained('2026-01-06T10:00:00Z', [
        entry({ exercise: 'b', muscle: 'pectorals' }), // misma parte: no suma
        entry({ exercise: 'c', muscle: 'quads' }), // legs
        entry({ exercise: 'd', muscle: 'lats', completed: false }), // sin series hechas: no cuenta
      ]),
    ]
    expect(computeUserMetrics(sessions).distinctBodyParts).toBe(2)
  })

  it('una entry solo con series sin completar no cuenta como ejercicio ni parte', () => {
    const sessions = [
      trained('2026-01-05T10:00:00Z', [entry({ exercise: 'x', muscle: 'biceps', completed: false })]),
    ]
    const m = computeUserMetrics(sessions)
    expect(m.distinctBodyParts).toBe(0)
    expect(m.distinctExercises).toBe(0)
  })

  it('cuenta ejercicios distintos del catálogo, no repeticiones', () => {
    const sessions = [
      trained('2026-01-05T10:00:00Z', [entry({ exercise: 'press', muscle: 'pectorals' })]),
      trained('2026-01-06T10:00:00Z', [
        entry({ exercise: 'press', muscle: 'pectorals' }), // repetido
        entry({ exercise: 'squat', muscle: 'quads' }),
      ]),
    ]
    expect(computeUserMetrics(sessions).distinctExercises).toBe(2)
  })

  it('mide el máximo de partes distintas en una misma semana ISO', () => {
    const sessions = [
      // Semana del lun 05 ene: chest + legs = 2
      trained('2026-01-05T10:00:00Z', [entry({ exercise: 'a', muscle: 'pectorals' })]),
      trained('2026-01-06T10:00:00Z', [entry({ exercise: 'b', muscle: 'quads' })]),
      // Semana del lun 12 ene: chest + legs + back = 3
      trained('2026-01-12T10:00:00Z', [entry({ exercise: 'a', muscle: 'pectorals' })]),
      trained('2026-01-13T10:00:00Z', [entry({ exercise: 'b', muscle: 'quads' })]),
      trained('2026-01-14T10:00:00Z', [entry({ exercise: 'c', muscle: 'lats' })]),
    ]
    expect(computeUserMetrics(sessions).maxBodyPartsInWeek).toBe(3)
  })

  it('la ventana de 30 días agrupa partes de días cercanos, no de meses lejanos', () => {
    // Ene 1 (chest) y Feb 1 (legs) están a 31 días: ninguna ventana de 30 los une.
    const apart = [
      trained('2026-01-01T10:00:00Z', [entry({ exercise: 'a', muscle: 'pectorals' })]),
      trained('2026-02-01T10:00:00Z', [entry({ exercise: 'b', muscle: 'quads' })]),
    ]
    expect(computeUserMetrics(apart).maxBodyPartsIn30DayWindow).toBe(1)

    // Ene 12 (legs), Ene 20 (back), Ene 25 (chest), Feb 10 (arms):
    // la ventana que termina el Feb 10 cubre desde el Ene 12 -> legs+back+chest+arms = 4.
    // La del Ene 25 cubre desde el Dic 27 -> legs+back+chest = 3. Gana la de 4.
    const near = [
      trained('2026-01-12T10:00:00Z', [entry({ exercise: 'b', muscle: 'quads' })]),
      trained('2026-01-20T10:00:00Z', [entry({ exercise: 'c', muscle: 'lats' })]),
      trained('2026-01-25T10:00:00Z', [entry({ exercise: 'a', muscle: 'pectorals' })]),
      trained('2026-02-10T10:00:00Z', [entry({ exercise: 'd', muscle: 'biceps' })]),
    ]
    expect(computeUserMetrics(near).maxBodyPartsIn30DayWindow).toBe(4)
  })

  it('cuenta sesiones con cardio completado', () => {
    const sessions = [
      trained('2026-01-05T10:00:00Z', [entry({ exercise: 'bike', muscle: 'cardio' })]),
      trained('2026-01-06T10:00:00Z', [entry({ exercise: 'bike', muscle: 'cardio', completed: false })]),
      trained('2026-01-07T10:00:00Z', [entry({ exercise: 'press', muscle: 'pectorals' })]),
    ]
    const m = computeUserMetrics(sessions)
    expect(m.cardioSessions).toBe(1)
    // cardio + chest; la sesión con cardio sin series hechas no suma una parte
    expect(m.distinctBodyParts).toBe(2)
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
