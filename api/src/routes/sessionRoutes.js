import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { requireAdminSecret } from '../middleware/requireAdminSecret.js'
import {
  listSessions,
  getActiveSession,
  getSession,
  createSession,
  updateSession,
  finishSession,
  deleteSession,
  sweepSessions,
} from '../controllers/sessionController.js'

const router = express.Router()

/**
 * /sweep va ANTES del `router.use(requireSession)` porque usa otro mecanismo
 * de auth: no es un usuario con cookie, es un cron externo con un secreto
 * en header. Mezclarlo con requireSession rompería el flujo (no hay cookie)
 * y arrastraría la ruta admin al mismo modelo de autorización que las de
 * usuario, que es justo lo que queremos evitar.
 */
router.post('/sweep', requireAdminSecret, sweepSessions)

router.use(requireSession)

/**
 * Orden importa: /active y /:id/finish son rutas estáticas que podrían
 * confundirse con un `:id` genérico. Express casa en el orden declarado,
 * así que las literales van ANTES del `/:id` dinámico. Si no, `/active`
 * entraría en getSession con params.id = 'active', y aunque el controller
 * ya lo rechazaría por no ser ObjectId válido, es mejor no depender de eso.
 */
router.get('/active', getActiveSession)
router.get('/', listSessions)
router.post('/', createSession)
router.get('/:id', getSession)
router.patch('/:id', updateSession)
router.post('/:id/finish', finishSession)
router.delete('/:id', deleteSession)

export default router
