import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  getExercises,
  getBodyParts,
  getMuscles,
  getExerciseById,
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

export default router
