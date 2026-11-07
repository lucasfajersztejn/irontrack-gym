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

// Toda ruta de rutinas requiere sesión. router.use lo aplica a lo que venga
// debajo sin que haya que repetirlo en cada línea. Si en el futuro expongo
// algo público (p.ej. plantillas del sistema), irá en otro router o antes
// del `router.use`.
router.use(requireSession)

router.get('/', listRoutines)
router.post('/', createRoutine)
// /reorder va antes que /:id para que no caiga en el handler dinámico.
router.patch('/reorder', reorderRoutines)
router.get('/:id', getRoutine)
router.patch('/:id', updateRoutine)
router.delete('/:id', deleteRoutine)

export default router
