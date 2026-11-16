import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getBadges } from '../controllers/badgeController.js'

const router = express.Router()
router.use(requireSession)

router.get('/', getBadges)

export default router
