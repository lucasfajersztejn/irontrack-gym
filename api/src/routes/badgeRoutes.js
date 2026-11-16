import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getBadges, getBadgeCounts } from '../controllers/badgeController.js'

const router = express.Router()
router.use(requireSession)

router.get('/', getBadges)
router.get('/counts', getBadgeCounts)

export default router
