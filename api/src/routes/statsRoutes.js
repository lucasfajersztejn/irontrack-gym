import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getMuscleRecency, getRecords } from '../controllers/statsController.js'

const router = express.Router()
router.use(requireSession)

router.get('/muscle-recency', getMuscleRecency)
router.get('/records', getRecords)

export default router
