import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  getMe,
  setUsername,
  updateSettings,
} from '../controllers/userController.js'

const router = express.Router()

router.get('/', requireSession, getMe)
router.post('/username', requireSession, setUsername)
router.patch('/settings', requireSession, updateSettings)

export default router
