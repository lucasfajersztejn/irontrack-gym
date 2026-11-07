import express from 'express'
import mongoose from 'mongoose'
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  listSessions,
} from '../../src/controllers/sessionController.js'

/**
 * Mini app para tests.
 *
 * Reemplaza requireSession por un stub que inyecta `req.user = { id: userId }`.
 * Los tests que viven aquí verifican invariante 3 (toda consulta filtra por
 * usuario): si cambiamos el usuario inyectado entre dos requests podemos
 * comprobar que ningún controller devuelve datos de otro.
 *
 * NO montamos sessionRoutes.js tal cual porque arrastra `requireSession`, que
 * depende de Better Auth y cookies reales. El trade-off: perdemos cobertura
 * del fichero de rutas (orden, 404 implícito) pero lo probaríamos con un e2e
 * completo, no con tests unitarios. Aquí interesa el controller.
 */
export function buildTestApp(userId) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    // Los controllers esperan `id` como string (lo convierten con
    // `new mongoose.Types.ObjectId(req.user.id)`). Si el test pasa ya un
    // ObjectId lo normalizamos: así ningún test tiene que pensar en eso.
    req.user = { id: userId instanceof mongoose.Types.ObjectId ? userId.toString() : userId }
    next()
  })

  const router = express.Router()
  router.get('/sessions', listSessions)
  router.post('/sessions', createSession)
  router.get('/sessions/:id', getSession)
  router.patch('/sessions/:id', updateSession)
  router.delete('/sessions/:id', deleteSession)
  app.use('/api', router)

  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message || 'Error interno' })
  })

  return app
}
