import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  listRoutines,
  createRoutine,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  reorderRoutines,
} from '../controllers/routineController.js'

const router = express.Router()

router.use(requireSession)

router.get('/', listRoutines)
router.post('/', createRoutine)
router.patch('/reorder', reorderRoutines)
router.get('/:id', getRoutine)
router.patch('/:id', updateRoutine)
router.delete('/:id', deleteRoutine)

export default router
