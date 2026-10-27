import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  getExercises,
  getBodyParts,
  getMuscles,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../controllers/exerciseController.js'

// Todas las rutas requieren sesión: el usuario autenticado ve el catálogo
// global + sus propios ejercicios custom. No hay catálogo anónimo (no hay
// landing demo todavía). Si en el futuro queremos exponerlo, bastará con
// mover handlers por encima de este router.use.
const router = express.Router()
router.use(requireSession)

router.get('/', getExercises)
router.get('/bodyparts', getBodyParts)
router.get('/muscles', getMuscles)
router.get('/:id', getExerciseById)

// Mutaciones: solo afectan a ejercicios custom del propio usuario; el
// catálogo global (createdBy: null) es inmutable desde la API.
router.post('/', createExercise)
router.patch('/:id', updateExercise)
router.delete('/:id', deleteExercise)

export default router
