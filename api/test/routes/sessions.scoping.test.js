import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'
import Routine from '../../src/models/routine.model.js'
import Exercise from '../../src/models/exercise.model.js'
import { buildTestApp } from '../helpers/app.js'

/**
 * Cubre la invariante #3 de CLAUDE.md: toda consulta filtra por usuario.
 *
 * Patrón: creamos dos IDs de usuario (A, B), damos de alta recursos propiedad
 * de A, y comprobamos que una app con el user B inyectado no puede verlos,
 * editarlos ni borrarlos. Si un controller cambiara `findById(id)` por
 * `findOne({ _id, user })` olvidando el segundo filtro, estos tests rompen.
 *
 * Se usa 404 en vez de 403: no queremos filtrar la existencia del recurso
 * ajeno — es lo que ya hacen los controllers y conviene cerrarlo con test.
 */
const userA = new mongoose.Types.ObjectId()
const userB = new mongoose.Types.ObjectId()

let exercise

beforeEach(async () => {
  exercise = await Exercise.create({
    slug: 'bench-press',
    name: { es: 'Press banca', en: 'Bench press' },
    muscle: 'pectorals',
    equipment: 'barbell',
    tracking: 'weight_reps',
  })
})

describe('Sesiones — aislamiento entre usuarios', () => {
  it('B no puede leer una sesión de A', async () => {
    const appA = buildTestApp(userA.toString())
    const appB = buildTestApp(userB.toString())

    const created = await request(appA)
      .post('/api/sessions')
      .send({ startedAt: new Date().toISOString() })
      .expect(201)

    await request(appA).get(`/api/sessions/${created.body._id}`).expect(200)
    await request(appB).get(`/api/sessions/${created.body._id}`).expect(404)
  })

  it('B no puede editar una sesión de A', async () => {
    const appA = buildTestApp(userA.toString())
    const appB = buildTestApp(userB.toString())

    const { body: sess } = await request(appA)
      .post('/api/sessions')
      .send({})
      .expect(201)

    await request(appB)
      .patch(`/api/sessions/${sess._id}`)
      .send({ notes: 'intento de secuestro' })
      .expect(404)

    // El PATCH de B no debe haber tocado nada en la base.
    const fresh = await Session.findById(sess._id)
    expect(fresh.notes).toBeFalsy()
  })

  it('B no puede borrar una sesión de A', async () => {
    const appA = buildTestApp(userA.toString())
    const appB = buildTestApp(userB.toString())

    const { body: sess } = await request(appA)
      .post('/api/sessions')
      .send({})
      .expect(201)

    await request(appB).delete(`/api/sessions/${sess._id}`).expect(404)
    expect(await Session.findById(sess._id)).not.toBeNull()
  })

  it('B no puede arrancar una sesión desde una rutina de A', async () => {
    const appB = buildTestApp(userB.toString())

    const routineA = await Routine.create({
      user: userA,
      name: 'Pecho A',
      exercises: [{
        exercise: exercise._id,
        order: 0,
        targetSets: 4,
        targetReps: 8,
        targetWeightKg: 60,
      }],
    })

    await request(appB)
      .post('/api/sessions')
      .send({ routine: routineA._id.toString() })
      .expect(404)
  })

  it('listSessions solo devuelve las del usuario autenticado', async () => {
    const appA = buildTestApp(userA.toString())
    const appB = buildTestApp(userB.toString())

    await Session.create([
      { user: userA, startedAt: new Date() },
      { user: userA, startedAt: new Date() },
      { user: userB, startedAt: new Date() },
    ])

    const resA = await request(appA).get('/api/sessions').expect(200)
    const resB = await request(appB).get('/api/sessions').expect(200)

    expect(resA.body).toHaveLength(2)
    expect(resB.body).toHaveLength(1)
  })
})
