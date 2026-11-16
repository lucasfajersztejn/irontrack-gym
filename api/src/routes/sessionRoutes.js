import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { requireAdminSecret } from '../middleware/requireAdminSecret.js'
import {
  listSessions,
  getHeatmap,
  getActiveSession,
  getSession,
  createSession,
  updateSession,
  finishSession,
  deleteSession,
  sweepSessions,
} from '../controllers/sessionController.js'

const router = express.Router()

router.post('/sweep', requireAdminSecret, sweepSessions)

router.use(requireSession)

router.get('/active', getActiveSession)
router.get('/heatmap', getHeatmap)
router.get('/', listSessions)
router.post('/', createSession)
router.get('/:id', getSession)
router.patch('/:id', updateSession)
router.post('/:id/finish', finishSession)
router.delete('/:id', deleteSession)

export default router
