import express from 'express'
import {
  getExercises,
  getBodyParts,
  getMuscles,
  getExerciseById,
} from '../controllers/exerciseController.js'

// Fase 1: endpoints públicos del catálogo (ejercicios con createdBy: null).
// Se añadirá el middleware de Better Auth cuando se expongan los custom.
const router = express.Router()

router.get('/', getExercises)
router.get('/bodyparts', getBodyParts)
router.get('/muscles', getMuscles)
router.get('/:id', getExerciseById)

export default router
