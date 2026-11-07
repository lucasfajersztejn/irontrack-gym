import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getMuscleRecency } from '../controllers/statsController.js'

// Agregaciones globales por usuario. Ver statsController para el porqué
// de este agrupamiento y su futuro.
const router = express.Router()
router.use(requireSession)

router.get('/muscle-recency', getMuscleRecency)

export default router
