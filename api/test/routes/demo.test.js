import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import User from '../../src/models/user.model.js'
import Session from '../../src/models/session.model.js'
import Routine from '../../src/models/routine.model.js'
import Badge from '../../src/models/badge.model.js'
import UserBadge from '../../src/models/userBadge.model.js'
import { DEMO_ACCOUNT } from '../../src/models/constants.js'
import { insertDemoCatalog } from '../helpers/demoCatalog.js'

/*
  Flujo real de la cuenta demo, de extremo a extremo, contra Better Auth de
  verdad (no un mock) y la Mongo en memoria del setup.

  La prueba clave es la ida y vuelta: el login forja la cookie y `requireSession`
  (el mismo middleware que protege la API) la acepta. Si Better Auth cambia el
  formato de firma, este test falla aquí y no el login en producción.
*/

const ADMIN_SECRET = 'test-admin-secret'
let app
let seedDemoUser

beforeAll(async () => {
  // config/auth.js valida el secreto al importarse y necesita URL base.
  process.env.BETTER_AUTH_SECRET ??= 'secreto-solo-para-tests-0123456789abcdef'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:5000'
  process.env.ADMIN_SECRET = ADMIN_SECRET

  // Import dinámico: config/auth.js lee MONGO_URI al importarse, y el setup
  // global lo fija en su beforeAll, que ya ha corrido cuando llega este hook.
  const { default: demoRoutes } = await import('../../src/routes/demoRoutes.js')
  const { default: adminRoutes } = await import('../../src/routes/adminRoutes.js')
  const { auth } = await import('../../src/config/auth.js')
  const { requireSession } = await import('../../src/middleware/requireSession.js')
  ;({ seedDemoUser } = await import('../../src/scripts/seedDemoUser.js'))

  // Mismo orden que api/src/index.js: demo antes del handler de Better Auth.
  const { toNodeHandler } = await import('better-auth/node')
  app = express()
  app.use('/api/auth/demo', demoRoutes)
  app.all('/api/auth/*', toNodeHandler(auth))
  app.use(express.json())
  app.use('/api/admin', adminRoutes)
  app.get('/whoami', requireSession, (req, res) => {
    res.json({ id: req.user.id, email: req.user.email })
  })
})

/** Nombre=valor de la cookie de sesión, listo para la cabecera Cookie. */
function sessionCookieFrom(res) {
  const setCookie = [].concat(res.headers['set-cookie'] ?? [])
  const sessionCookie = setCookie.find((c) => /session_token=/.test(c))
  return sessionCookie ? sessionCookie.split(';')[0] : null
}

describe('login demo', () => {
  it('sin cuenta sembrada responde 503 con la instrucción y NO la crea', async () => {
    const res = await request(app).post('/api/auth/demo')

    expect(res.status).toBe(503)
    expect(res.body.message).toMatch(/seed:demo/)
    expect(await User.countDocuments({ email: DEMO_ACCOUNT.email })).toBe(0)
  })

  it('con la cuenta sembrada firma una sesión que requireSession acepta', async () => {
    await insertDemoCatalog()
    await seedDemoUser()
    const demo = await User.findOne({ email: DEMO_ACCOUNT.email }).lean()

    const login = await request(app).post('/api/auth/demo')
    expect(login.status).toBe(200)
    const cookie = sessionCookieFrom(login)
    expect(cookie).not.toBeNull()

    const who = await request(app).get('/whoami').set('Cookie', cookie)
    expect(who.status).toBe(200)
    expect(who.body.email).toBe(DEMO_ACCOUNT.email)
    expect(who.body.id).toBe(String(demo._id))
  })

  it('una firma alterada NO vale (control negativo: la firma sí se comprueba)', async () => {
    await insertDemoCatalog()
    await seedDemoUser()

    const login = await request(app).post('/api/auth/demo')
    const cookie = sessionCookieFrom(login)
    const [name, value] = cookie.split('=')
    const tampered = `${name}=${value.slice(0, -4)}AAAA`

    const who = await request(app).get('/whoami').set('Cookie', tampered)
    expect(who.status).toBe(401)
  })
})

describe('seed y reseed de la cuenta demo', () => {
  it('sembrar dos veces deja un único usuario con los mismos datos', async () => {
    await insertDemoCatalog()
    const first = await seedDemoUser()
    const second = await seedDemoUser()

    expect(await User.countDocuments({ email: DEMO_ACCOUNT.email })).toBe(1)
    expect(second.sessions).toBe(first.sessions)
    expect(await Session.countDocuments({})).toBe(second.sessions)
    expect(await Routine.countDocuments({})).toBe(3)
  })

  it('cada sesión es válida según el modelo real (tracking y timestamps)', async () => {
    await insertDemoCatalog()
    await seedDemoUser()

    const sessions = await Session.find({}).lean()
    const trackings = new Set()
    for (const s of sessions) {
      expect(s.endedAt.getTime()).toBeGreaterThan(s.startedAt.getTime())
      for (const e of s.entries) {
        trackings.add(e.tracking)
        expect(e.sets.length).toBeGreaterThan(0)
      }
      // Revalida con el esquema real: el pre('validate') cruza tracking y series.
      await new Session(s).validate()
    }
    // Los cuatro trackings aparecen: la demo cubre todos los tipos de serie.
    expect([...trackings].sort()).toEqual(['distance_time', 'reps', 'time', 'weight_reps'])
  })

  it('el contador de uso de cada plantilla cuadra con sus sesiones', async () => {
    await insertDemoCatalog()
    const summary = await seedDemoUser()

    const routines = await Routine.find({}).lean()
    const totalUses = routines.reduce((sum, r) => sum + r.timesUsed, 0)
    expect(totalUses).toBe(summary.sessions)
  })

  it('tras sembrar, las insignias del catálogo que cumple la demo se desbloquean', async () => {
    await insertDemoCatalog()
    await Badge.create({
      slug: 'first-session',
      name: { es: 'Primer paso', en: 'First step' },
      description: { es: 'Tu primera sesión.', en: 'Your first session.' },
      category: 'hitos',
      tier: 'bronce',
      rule: { type: 'sessionCount', operator: 'gte', value: 1 },
    })

    const summary = await seedDemoUser()
    expect(summary.catalogBadges).toBe(1)
    expect(summary.unlockedBadges).toBe(1)
    expect(await UserBadge.countDocuments({})).toBe(1)
  })

  it('POST /api/admin/demo/reseed exige el secreto de operador', async () => {
    await insertDemoCatalog()
    const res = await request(app).post('/api/admin/demo/reseed')
    expect(res.status).toBe(401)
  })

  it('POST /api/admin/demo/reseed con el secreto reseedea la cuenta', async () => {
    await insertDemoCatalog()
    const res = await request(app)
      .post('/api/admin/demo/reseed')
      .set('X-Admin-Secret', ADMIN_SECRET)

    expect(res.status).toBe(200)
    expect(res.body.email).toBe(DEMO_ACCOUNT.email)
    expect(res.body.sessions).toBeGreaterThan(40)
    expect(await User.countDocuments({ email: DEMO_ACCOUNT.email })).toBe(1)
  })
})
