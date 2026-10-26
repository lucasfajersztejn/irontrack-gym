import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getMe, setUsername } from '../controllers/userController.js'

const router = express.Router()

router.get('/', requireSession, getMe)
router.post('/username', requireSession, setUsername)

export default router
