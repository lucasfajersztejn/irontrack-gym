import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  listSessions,
  getActiveSession,
  getSession,
  createSession,
  updateSession,
  finishSession,
  deleteSession,
} from '../controllers/sessionController.js'

const router = express.Router()

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
