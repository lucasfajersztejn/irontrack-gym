import express from 'express'
import {
  getExercises,
  getBodyParts,
  getMuscles,
  getExerciseById,
} from '../controllers/exerciseController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getExercises)
router.get('/bodyparts', protect, getBodyParts)
router.get('/muscles', protect, getMuscles)
router.get('/:id', protect, getExerciseById)

export default router