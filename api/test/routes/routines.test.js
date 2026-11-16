import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import Routine from '../../src/models/routine.model.js'
import Exercise from '../../src/models/exercise.model.js'
import {
  listRoutines,
  createRoutine,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  reorderRoutines,
} from '../../src/controllers/routineController.js'

function buildApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId.toString() }
    next()
  })
  app.get('/api/routines', listRoutines)
  app.post('/api/routines', createRoutine)
  app.patch('/api/routines/reorder', reorderRoutines)
  app.get('/api/routines/:id', getRoutine)
  app.patch('/api/routines/:id', updateRoutine)
  app.delete('/api/routines/:id', deleteRoutine)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message })
  })
  return app
}

const userA = new mongoose.Types.ObjectId()
const userB = new mongoose.Types.ObjectId()
let exercise

function payload(overrides = {}) {
  return {
    name: 'Pecho A',
    exercises: [{ exercise: exercise._id.toString(), order: 0, targetSets: 4, targetReps: 8, targetWeightKg: 60 }],
    ...overrides,
  }
}

beforeEach(async () => {
  exercise = await Exercise.create({
    slug: 'bench-press',
    name: { es: 'Press banca', en: 'Bench press' },
    muscle: 'pectorals',
    equipment: 'barbell',
    tracking: 'weight_reps',
  })
})

describe('Rutinas — flujos felices', () => {
  it('crea una rutina asignada al usuario con orden incremental', async () => {
    const app = buildApp(userA)

    const first = await request(app).post('/api/routines').send(payload()).expect(201)
    const second = await request(app).post('/api/routines').send(payload({ name: 'Pecho B' })).expect(201)

    expect(first.body.user).toBe(userA.toString())
    expect(first.body.order).toBe(0)
    expect(second.body.order).toBe(1)
    expect(first.body.exercises[0].targetWeightKg).toBe(60)
  })

  it('lista un resumen con grupos musculares y número de ejercicios', async () => {
    const app = buildApp(userA)
    await request(app).post('/api/routines').send(payload()).expect(201)

    const { body } = await request(app).get('/api/routines').expect(200)

    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Pecho A')
    expect(body[0].muscles).toEqual(['pectorals'])
    expect(body[0].exerciseCount).toBe(1)
    expect(body[0].exercises).toBeUndefined()
  })

  it('devuelve el detalle con los ejercicios poblados', async () => {
    const app = buildApp(userA)
    const { body: created } = await request(app).post('/api/routines').send(payload()).expect(201)

    const { body } = await request(app).get(`/api/routines/${created._id}`).expect(200)

    expect(body.exercises[0].exercise.slug).toBe('bench-press')
  })

  it('edita campos de la rutina', async () => {
    const app = buildApp(userA)
    const { body: created } = await request(app).post('/api/routines').send(payload()).expect(201)

    const { body } = await request(app)
      .patch(`/api/routines/${created._id}`)
      .send({ name: 'Pecho Pesado' })
      .expect(200)

    expect(body.name).toBe('Pecho Pesado')
    expect(body.exercises).toHaveLength(1)
  })

  it('borra la rutina', async () => {
    const app = buildApp(userA)
    const { body: created } = await request(app).post('/api/routines').send(payload()).expect(201)

    await request(app).delete(`/api/routines/${created._id}`).expect(204)

    expect(await Routine.findById(created._id)).toBeNull()
  })

  it('persiste el nuevo orden de las rutinas según la lista de ids', async () => {
    const app = buildApp(userA)
    const { body: r1 } = await request(app).post('/api/routines').send(payload({ name: 'Uno' })).expect(201)
    const { body: r2 } = await request(app).post('/api/routines').send(payload({ name: 'Dos' })).expect(201)

    await request(app).patch('/api/routines/reorder').send({ ids: [r2._id, r1._id] }).expect(204)

    const stored = await Routine.find({ user: userA }).sort({ order: 1 }).lean()
    expect(stored.map((r) => r.name)).toEqual(['Dos', 'Uno'])
  })
})

describe('Rutinas — validación', () => {
  it('rechaza una rutina sin ejercicios', async () => {
    await request(buildApp(userA)).post('/api/routines').send(payload({ exercises: [] })).expect(400)
  })

  it('rechaza un nombre vacío', async () => {
    await request(buildApp(userA)).post('/api/routines').send(payload({ name: '  ' })).expect(400)
  })

  it('rechaza un PATCH vacío', async () => {
    const app = buildApp(userA)
    const { body: created } = await request(app).post('/api/routines').send(payload()).expect(201)

    await request(app).patch(`/api/routines/${created._id}`).send({}).expect(400)
  })

  it('rechaza ids duplicados al reordenar', async () => {
    const app = buildApp(userA)
    const { body: r1 } = await request(app).post('/api/routines').send(payload()).expect(201)

    await request(app).patch('/api/routines/reorder').send({ ids: [r1._id, r1._id] }).expect(400)
  })

  it('responde 404 ante un id malformado', async () => {
    await request(buildApp(userA)).get('/api/routines/no-es-un-id').expect(404)
  })
})

describe('Rutinas — aislamiento entre usuarios', () => {
  let routineA

  beforeEach(async () => {
    const { body } = await request(buildApp(userA)).post('/api/routines').send(payload()).expect(201)
    routineA = body
  })

  it('B no puede leer una rutina de A', async () => {
    await request(buildApp(userA)).get(`/api/routines/${routineA._id}`).expect(200)
    await request(buildApp(userB)).get(`/api/routines/${routineA._id}`).expect(404)
  })

  it('B no puede editar una rutina de A', async () => {
    await request(buildApp(userB))
      .patch(`/api/routines/${routineA._id}`)
      .send({ name: 'secuestrada' })
      .expect(404)

    const fresh = await Routine.findById(routineA._id)
    expect(fresh.name).toBe('Pecho A')
  })

  it('B no puede borrar una rutina de A', async () => {
    await request(buildApp(userB)).delete(`/api/routines/${routineA._id}`).expect(404)

    expect(await Routine.findById(routineA._id)).not.toBeNull()
  })

  it('B no puede reordenar rutinas de A', async () => {
    await request(buildApp(userB))
      .patch('/api/routines/reorder')
      .send({ ids: [routineA._id] })
      .expect(403)
  })

  it('el listado solo incluye las rutinas del usuario autenticado', async () => {
    await request(buildApp(userB)).post('/api/routines').send(payload({ name: 'De B' })).expect(201)

    const { body: listA } = await request(buildApp(userA)).get('/api/routines').expect(200)
    const { body: listB } = await request(buildApp(userB)).get('/api/routines').expect(200)

    expect(listA.map((r) => r.name)).toEqual(['Pecho A'])
    expect(listB.map((r) => r.name)).toEqual(['De B'])
  })
})
