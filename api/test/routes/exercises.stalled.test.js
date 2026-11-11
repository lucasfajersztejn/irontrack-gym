import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'
import { getStalled } from '../../src/controllers/exerciseController.js'

/**
 * Cubre GET /api/exercises/stalled: detección de ejercicios en los que el
 * usuario no bate su mejor 1RM desde hace >= 6 sesiones y que sigue
 * entrenando (última sesión dentro de las últimas 8 semanas).
 *
 * No montamos exerciseRoutes.js entero porque arrastra requireSession (Better
 * Auth + cookies). Aquí interesa la lógica del controller, no el router; un
 * stub de usuario basta, mismo trade-off que el helper de sessions.
 */
function buildApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId.toString() }
    next()
  })
  app.get('/api/exercises/stalled', getStalled)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message })
  })
  return app
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Crea una sesión cerrada con un único ejercicio weight_reps de una serie
 * completada. `daysAgo` fija la fecha; peso/reps controlan el 1RM del día.
 */
function makeSession({ user, exercise, name, daysAgo, weightKg, reps }) {
  const startedAt = new Date(Date.now() - daysAgo * DAY)
  return Session.create({
    user,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
    entries: [
      {
        exercise,
        exerciseName: name,
        muscle: 'pectorals',
        tracking: 'weight_reps',
        order: 0,
        sets: [{ order: 0, weightKg, reps, completed: true }],
      },
    ],
  })
}

describe('GET /api/exercises/stalled', () => {
  const user = new mongoose.Types.ObjectId()

  it('marca un ejercicio plano hace >= 6 sesiones y aún activo', async () => {
    const bench = new mongoose.Types.ObjectId()
    // Pico el día más antiguo (100 kg), y 7 sesiones por debajo después.
    // Todas dentro de 8 semanas -> estancado con sessionsSince = 7.
    await makeSession({ user, exercise: bench, name: 'Press banca', daysAgo: 50, weightKg: 100, reps: 5 })
    for (const daysAgo of [45, 40, 35, 30, 25, 20, 15]) {
      await makeSession({ user, exercise: bench, name: 'Press banca', daysAgo, weightKg: 95, reps: 5 })
    }

    const res = await request(buildApp(user)).get('/api/exercises/stalled').expect(200)

    expect(res.body.stalled).toHaveLength(1)
    const row = res.body.stalled[0]
    expect(row.exerciseId).toBe(bench.toString())
    expect(row.sessionsSince).toBe(7)
    expect(row.peakHeaviestKg).toBe(100)
  })

  it('no marca un ejercicio que bate su 1RM cada sesión', async () => {
    const squat = new mongoose.Types.ObjectId()
    let w = 80
    for (const daysAgo of [40, 30, 20, 10, 5, 2]) {
      await makeSession({ user, exercise: squat, name: 'Sentadilla', daysAgo, weightKg: w, reps: 5 })
      w += 5 // nuevo PR cada vez -> sessionsSince se queda en 0
    }

    const res = await request(buildApp(user)).get('/api/exercises/stalled').expect(200)
    expect(res.body.stalled).toHaveLength(0)
  })

  it('ignora un ejercicio estancado pero abandonado (> 8 semanas)', async () => {
    const deadlift = new mongoose.Types.ObjectId()
    // Mismo patrón de meseta, pero la última sesión fue hace 90 días.
    await makeSession({ user, exercise: deadlift, name: 'Peso muerto', daysAgo: 120, weightKg: 140, reps: 3 })
    for (const daysAgo of [115, 110, 105, 100, 97, 94, 90]) {
      await makeSession({ user, exercise: deadlift, name: 'Peso muerto', daysAgo, weightKg: 135, reps: 3 })
    }

    const res = await request(buildApp(user)).get('/api/exercises/stalled').expect(200)
    expect(res.body.stalled).toHaveLength(0)
  })

  it('no cuenta sesiones sin trabajo válido como sesiones sin PR', async () => {
    const row = new mongoose.Types.ObjectId()
    // Solo 5 sesiones por debajo del pico: 5 < 6, no debería marcarse.
    await makeSession({ user, exercise: row, name: 'Remo', daysAgo: 40, weightKg: 80, reps: 8 })
    for (const daysAgo of [35, 30, 25, 20, 15]) {
      await makeSession({ user, exercise: row, name: 'Remo', daysAgo, weightKg: 75, reps: 8 })
    }

    const res = await request(buildApp(user)).get('/api/exercises/stalled').expect(200)
    expect(res.body.stalled).toHaveLength(0)
  })
})
