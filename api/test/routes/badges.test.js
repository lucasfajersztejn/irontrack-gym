import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import Session from '../../src/models/session.model.js'
import Badge from '../../src/models/badge.model.js'
import UserBadge from '../../src/models/userBadge.model.js'
import { getBadges } from '../../src/controllers/badgeController.js'

function buildApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { id: userId.toString() }
    next()
  })
  app.get('/api/badges', getBadges)
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message })
  })
  return app
}

async function closedSession(user, day) {
  const startedAt = new Date(`2026-04-${String(day).padStart(2, '0')}T10:00:00Z`)
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

describe('GET /api/badges', () => {
  const user = new mongoose.Types.ObjectId()

  async function seedTwoBadges() {
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
        slug: 'streak-10',
        name: { es: 'Diez', en: 'Ten' },
        description: { es: 'Diez días', en: 'Ten days' },
        category: 'constancia',
        tier: 'oro',
        rule: { type: 'streak', operator: 'gte', value: 10 },
      },
    ])
  }

  it('devuelve el catálogo completo con estado y progreso', async () => {
    await seedTwoBadges()
    await closedSession(user, 1)
    await closedSession(user, 2) // racha de 2
    // Marca streak-2 como ya ganada, como haría el motor al cerrar.
    const earned = await Badge.findOne({ slug: 'streak-2' })
    await UserBadge.create({ user, badge: earned._id, unlockedAt: new Date() })

    const res = await request(buildApp(user)).get('/api/badges').expect(200)

    expect(res.body.badges).toHaveLength(2)
    expect(res.body.counts).toEqual({ unlocked: 1, total: 2 })

    const bySlug = Object.fromEntries(res.body.badges.map((b) => [b.slug, b]))
    expect(bySlug['streak-2'].unlocked).toBe(true)
    expect(bySlug['streak-2'].progress.pct).toBe(100)
    // Bloqueada: racha 2 de 10 -> 20%.
    expect(bySlug['streak-10'].unlocked).toBe(false)
    expect(bySlug['streak-10'].progress).toMatchObject({ current: 2, target: 10, pct: 20 })
  })

  it('un usuario sin historial ve todo bloqueado al 0%', async () => {
    await seedTwoBadges()
    const other = new mongoose.Types.ObjectId()

    const res = await request(buildApp(other)).get('/api/badges').expect(200)
    expect(res.body.counts.unlocked).toBe(0)
    expect(res.body.badges.every((b) => !b.unlocked && b.progress.pct === 0)).toBe(true)
  })
})
