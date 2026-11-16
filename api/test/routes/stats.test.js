import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'
import Exercise from '../../src/models/exercise.model.js'
import { getMuscleRecency, getRecords } from '../../src/controllers/statsController.js'

function buildApp(userId) {
  const app = express()
  app.use((req, _res, next) => {
    req.user = { id: userId.toString() }
    next()
  })
  app.get('/api/stats/muscle-recency', getMuscleRecency)
  app.get('/api/stats/records', getRecords)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message })
  })
  return app
}

const userA = new mongoose.Types.ObjectId()
const userB = new mongoose.Types.ObjectId()

function createExercise(slug, tracking = 'weight_reps', muscle = 'pectorals') {
  return Exercise.create({
    slug,
    name: { es: slug, en: slug },
    muscle,
    equipment: 'barbell',
    tracking,
  })
}

function entryFor(exercise, sets, tracking = 'weight_reps') {
  return {
    exercise: exercise._id,
    exerciseName: exercise.slug,
    muscle: exercise.muscle,
    tracking,
    order: 0,
    sets: sets.map((s, order) => ({ order, completed: true, ...s })),
  }
}

function sessionFor(user, startedAt, entries) {
  return Session.create({
    user,
    startedAt: new Date(startedAt),
    endedAt: new Date(new Date(startedAt).getTime() + 3_600_000),
    entries,
  })
}

describe('GET /api/stats/records', () => {
  it('calcula peso máximo y 1RM estimado en kg a partir de series completadas', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [
      entryFor(bench, [{ weightKg: 100, reps: 5 }, { weightKg: 80, reps: 10 }]),
    ])
    await sessionFor(userA, '2026-04-08T10:00:00Z', [
      entryFor(bench, [{ weightKg: 110, reps: 3 }]),
    ])

    const { body } = await request(buildApp(userA)).get('/api/stats/records').expect(200)

    expect(body.records).toHaveLength(1)
    const [rec] = body.records
    expect(rec.exerciseId).toBe(bench._id.toString())
    expect(rec.name).toEqual({ es: 'bench-press', en: 'bench-press' })
    expect(rec.heaviestKg.value).toBe(110)
    expect(rec.heaviestKg.achievedAt).toBe('2026-04-08T10:00:00.000Z')
    expect(rec.best1RM.value).toBe(121)
    expect(rec.bestReps).toBeNull()
  })

  it('ignora las series sin completar', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [
      entryFor(bench, [{ weightKg: 200, reps: 1, completed: false }]),
    ])

    const { body } = await request(buildApp(userA)).get('/api/stats/records').expect(200)

    expect(body.records).toEqual([])
  })

  it('registra el mejor número de repeticiones en ejercicios de tracking reps', async () => {
    const pullUp = await createExercise('pull-up', 'reps', 'lats')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [
      entryFor(pullUp, [{ reps: 8 }, { reps: 12 }], 'reps'),
    ])

    const { body } = await request(buildApp(userA)).get('/api/stats/records').expect(200)

    expect(body.records[0].bestReps.value).toBe(12)
    expect(body.records[0].heaviestKg).toBeNull()
  })

  it('no incluye ejercicios de tiempo', async () => {
    const plank = await createExercise('plank', 'time', 'abs')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [
      entryFor(plank, [{ durationSec: 60 }], 'time'),
    ])

    const { body } = await request(buildApp(userA)).get('/api/stats/records').expect(200)

    expect(body.records).toEqual([])
  })

  it('ordena los récords por el más reciente primero', async () => {
    const bench = await createExercise('bench-press')
    const squat = await createExercise('squat', 'weight_reps', 'quads')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])
    await sessionFor(userA, '2026-04-08T10:00:00Z', [entryFor(squat, [{ weightKg: 140, reps: 5 }])])

    const { body } = await request(buildApp(userA)).get('/api/stats/records').expect(200)

    expect(body.records.map((r) => r.exerciseName)).toEqual(['squat', 'bench-press'])
  })

  it('no mezcla los récords de otro usuario', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])
    await sessionFor(userB, '2026-04-02T10:00:00Z', [entryFor(bench, [{ weightKg: 180, reps: 5 }])])

    const resA = await request(buildApp(userA)).get('/api/stats/records').expect(200)
    const resB = await request(buildApp(userB)).get('/api/stats/records').expect(200)

    expect(resA.body.records[0].heaviestKg.value).toBe(100)
    expect(resB.body.records[0].heaviestKg.value).toBe(180)
  })

  it('un usuario sin sesiones recibe una lista vacía', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])

    const { body } = await request(buildApp(userB)).get('/api/stats/records').expect(200)

    expect(body.records).toEqual([])
  })
})

describe('GET /api/stats/muscle-recency', () => {
  it('devuelve la última fecha por músculo y null para los no entrenados', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])
    await sessionFor(userA, '2026-04-08T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])

    const { body } = await request(buildApp(userA)).get('/api/stats/muscle-recency').expect(200)

    expect(body.byMuscle.pectorals).toBe('2026-04-08T10:00:00.000Z')
    expect(body.byMuscle.quads).toBeNull()
    expect(body.byMuscle.cardio).toBeUndefined()
    expect(typeof body.now).toBe('string')
  })

  it('ignora músculos cuyas series no están completadas', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [
      entryFor(bench, [{ weightKg: 100, reps: 5, completed: false }]),
    ])

    const { body } = await request(buildApp(userA)).get('/api/stats/muscle-recency').expect(200)

    expect(body.byMuscle.pectorals).toBeNull()
  })

  it('no filtra el entrenamiento de otro usuario', async () => {
    const bench = await createExercise('bench-press')
    await sessionFor(userA, '2026-04-01T10:00:00Z', [entryFor(bench, [{ weightKg: 100, reps: 5 }])])

    const { body } = await request(buildApp(userB)).get('/api/stats/muscle-recency').expect(200)

    expect(body.byMuscle.pectorals).toBeNull()
  })
})
