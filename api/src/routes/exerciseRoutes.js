import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  getExercises,
  getBodyParts,
  getMuscles,
  getExerciseById,
  getExercisesHistory,
  getExerciseProgress,
  getRecentPrs,
  getStalled,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../controllers/exerciseController.js'

const router = express.Router()
router.use(requireSession)

router.get('/', getExercises)
router.get('/bodyparts', getBodyParts)
router.get('/muscles', getMuscles)
router.get('/history', getExercisesHistory)
router.get('/recent-prs', getRecentPrs)
router.get('/stalled', getStalled)
router.get('/:id/progress', getExerciseProgress)
router.get('/:id', getExerciseById)

router.post('/', createExercise)
router.patch('/:id', updateExercise)
router.delete('/:id', deleteExercise)

export default router
