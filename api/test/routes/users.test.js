import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import User from '../../src/models/user.model.js'
import Exercise from '../../src/models/exercise.model.js'
import {
  getMe,
  setUsername,
  updateSettings,
  addFavorite,
  removeFavorite,
  setAlias,
  removeAlias,
} from '../../src/controllers/userController.js'

function buildApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId.toString() }
    next()
  })
  app.get('/api/me', getMe)
  app.post('/api/me/username', setUsername)
  app.patch('/api/me/settings', updateSettings)
  app.put('/api/me/favorites/:exerciseId', addFavorite)
  app.delete('/api/me/favorites/:exerciseId', removeFavorite)
  app.put('/api/me/aliases/:exerciseId', setAlias)
  app.delete('/api/me/aliases/:exerciseId', removeAlias)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message })
  })
  return app
}

let alice
let bob
let catalogExercise
let aliceCustom

beforeEach(async () => {
  alice = await User.create({ email: 'alice@example.com', name: 'Alice' })
  bob = await User.create({ email: 'bob@example.com', name: 'Bob' })
  catalogExercise = await Exercise.create({
    slug: 'bench-press',
    name: { es: 'Press banca', en: 'Bench press' },
    muscle: 'pectorals',
    equipment: 'barbell',
    tracking: 'weight_reps',
  })
  aliceCustom = await Exercise.create({
    slug: 'alice-special',
    name: { es: 'Especial', en: 'Special' },
    muscle: 'biceps',
    equipment: 'dumbbell',
    tracking: 'weight_reps',
    createdBy: alice._id,
  })
})

describe('GET /api/me', () => {
  it('devuelve el perfil propio con needsOnboarding mientras no hay username', async () => {
    const { body } = await request(buildApp(alice._id)).get('/api/me').expect(200)

    expect(body.id).toBe(alice._id.toString())
    expect(body.email).toBe('alice@example.com')
    expect(body.needsOnboarding).toBe(true)
    expect(body.settings.defaultBarWeightKg).toBe(20)
    expect(body.privacy).toBe('private')
  })

  it('devuelve solo los datos del usuario autenticado, nunca los de otro', async () => {
    const { body } = await request(buildApp(bob._id)).get('/api/me').expect(200)

    expect(body.email).toBe('bob@example.com')
    expect(JSON.stringify(body)).not.toContain('alice@example.com')
  })

  it('no expone campos internos del documento', async () => {
    await User.collection.updateOne({ _id: alice._id }, { $set: { internalNote: 'privado' } })

    const { body } = await request(buildApp(alice._id)).get('/api/me').expect(200)

    expect(body.internalNote).toBeUndefined()
    expect(body.__v).toBeUndefined()
  })

  it('responde 404 si el usuario no existe', async () => {
    await request(buildApp(new mongoose.Types.ObjectId())).get('/api/me').expect(404)
  })
})

describe('Perfil — toPublicJSON', () => {
  it('no incluye email, settings ni favoritos', async () => {
    await User.findByIdAndUpdate(alice._id, { username: 'alice' })
    const fresh = await User.findById(alice._id)

    const publicJson = fresh.toPublicJSON()

    expect(Object.keys(publicJson).sort()).toEqual(['createdAt', 'image', 'name', 'username'])
    expect(publicJson.username).toBe('alice')
    expect(publicJson.email).toBeUndefined()
    expect(publicJson.settings).toBeUndefined()
    expect(publicJson.favoriteExercises).toBeUndefined()
  })
})

describe('POST /api/me/username', () => {
  it('asigna el username normalizado y cierra el onboarding', async () => {
    const app = buildApp(alice._id)

    const { body } = await request(app).post('/api/me/username').send({ username: '  Alice_99 ' }).expect(200)
    expect(body.username).toBe('alice_99')

    const me = await request(app).get('/api/me').expect(200)
    expect(me.body.needsOnboarding).toBe(false)
  })

  it('rechaza un formato inválido', async () => {
    await request(buildApp(alice._id)).post('/api/me/username').send({ username: 'a b' }).expect(400)
    await request(buildApp(alice._id)).post('/api/me/username').send({ username: 'ab' }).expect(400)
  })

  it('rechaza un username reservado', async () => {
    await request(buildApp(alice._id)).post('/api/me/username').send({ username: 'admin' }).expect(409)
  })

  it('rechaza un username ya en uso por otro usuario', async () => {
    await request(buildApp(alice._id)).post('/api/me/username').send({ username: 'alice' }).expect(200)

    await request(buildApp(bob._id)).post('/api/me/username').send({ username: 'alice' }).expect(409)
  })

  it('no permite cambiar un username ya asignado', async () => {
    const app = buildApp(alice._id)
    await request(app).post('/api/me/username').send({ username: 'alice' }).expect(200)

    await request(app).post('/api/me/username').send({ username: 'otro-nombre' }).expect(409)
  })
})

describe('PATCH /api/me/settings', () => {
  it('actualiza solo los campos enviados', async () => {
    const { body } = await request(buildApp(alice._id))
      .patch('/api/me/settings')
      .send({ restTimerSec: 0, weeklyGoal: 5 })
      .expect(200)

    expect(body.settings.restTimerSec).toBe(0)
    expect(body.settings.weeklyGoal).toBe(5)
    expect(body.settings.defaultBarWeightKg).toBe(20)
  })

  it('rechaza valores fuera de rango y payload vacío', async () => {
    const app = buildApp(alice._id)

    await request(app).patch('/api/me/settings').send({ weeklyGoal: 30 }).expect(400)
    await request(app).patch('/api/me/settings').send({ defaultBarWeightKg: -1 }).expect(400)
    await request(app).patch('/api/me/settings').send({}).expect(400)
  })

  it('no toca los ajustes de otro usuario', async () => {
    await request(buildApp(alice._id)).patch('/api/me/settings').send({ weeklyGoal: 7 }).expect(200)

    const freshBob = await User.findById(bob._id)
    expect(freshBob.settings.weeklyGoal).toBe(4)
  })
})

describe('Favoritos', () => {
  it('añade y quita un ejercicio del catálogo sin duplicar', async () => {
    const app = buildApp(alice._id)
    const url = `/api/me/favorites/${catalogExercise._id}`

    await request(app).put(url).expect(200)
    const added = await request(app).put(url).expect(200)
    expect(added.body.favoriteExercises).toEqual([catalogExercise._id.toString()])

    const removed = await request(app).delete(url).expect(200)
    expect(removed.body.favoriteExercises).toEqual([])
  })

  it('B no puede marcar como favorito un ejercicio custom de A', async () => {
    await request(buildApp(bob._id)).put(`/api/me/favorites/${aliceCustom._id}`).expect(404)

    const freshBob = await User.findById(bob._id)
    expect(freshBob.favoriteExercises).toHaveLength(0)
  })

  it('el propietario sí puede marcar su ejercicio custom', async () => {
    await request(buildApp(alice._id)).put(`/api/me/favorites/${aliceCustom._id}`).expect(200)
  })

  it('los favoritos de un usuario no aparecen en el perfil de otro', async () => {
    await request(buildApp(alice._id)).put(`/api/me/favorites/${catalogExercise._id}`).expect(200)

    const { body } = await request(buildApp(bob._id)).get('/api/me').expect(200)

    expect(body.favoriteExercises).toEqual([])
  })

  it('responde 404 ante un id malformado o inexistente', async () => {
    const app = buildApp(alice._id)

    await request(app).put('/api/me/favorites/no-es-un-id').expect(404)
    await request(app).put(`/api/me/favorites/${new mongoose.Types.ObjectId()}`).expect(404)
  })
})

describe('Alias de ejercicios', () => {
  it('guarda un alias, aparece en el perfil y se puede borrar', async () => {
    const app = buildApp(alice._id)
    const url = `/api/me/aliases/${catalogExercise._id}`

    const set = await request(app).put(url).send({ name: '  Banca plana ' }).expect(200)
    expect(set.body.exerciseAliases[catalogExercise._id.toString()]).toBe('Banca plana')

    const me = await request(app).get('/api/me').expect(200)
    expect(me.body.exerciseAliases[catalogExercise._id.toString()]).toBe('Banca plana')

    const removed = await request(app).delete(url).expect(200)
    expect(removed.body.exerciseAliases).toEqual({})
  })

  it('rechaza nombres vacíos o demasiado largos', async () => {
    const app = buildApp(alice._id)
    const url = `/api/me/aliases/${catalogExercise._id}`

    await request(app).put(url).send({ name: '   ' }).expect(400)
    await request(app).put(url).send({ name: 'x'.repeat(41) }).expect(400)
  })

  it('B no puede poner alias a un ejercicio custom de A', async () => {
    await request(buildApp(bob._id))
      .put(`/api/me/aliases/${aliceCustom._id}`)
      .send({ name: 'robado' })
      .expect(404)

    const freshBob = await User.findById(bob._id)
    expect(freshBob.exerciseAliases.size).toBe(0)
  })

  it('el alias de A no se ve ni se borra desde la cuenta de B', async () => {
    const url = `/api/me/aliases/${catalogExercise._id}`
    await request(buildApp(alice._id)).put(url).send({ name: 'Mi banca' }).expect(200)

    const { body } = await request(buildApp(bob._id)).get('/api/me').expect(200)
    expect(body.exerciseAliases).toEqual({})

    await request(buildApp(bob._id)).delete(url).expect(200)
    const freshAlice = await User.findById(alice._id)
    expect(freshAlice.exerciseAliases.get(catalogExercise._id.toString())).toBe('Mi banca')
  })
})
