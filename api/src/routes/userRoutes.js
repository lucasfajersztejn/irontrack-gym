import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import {
  addFavorite,
  getMe,
  removeAlias,
  removeFavorite,
  setAlias,
  setUsername,
  updateSettings,
} from '../controllers/userController.js'

const router = express.Router()

router.get('/', requireSession, getMe)
router.post('/username', requireSession, setUsername)
router.patch('/settings', requireSession, updateSettings)
router.put('/favorites/:exerciseId', requireSession, addFavorite)
router.delete('/favorites/:exerciseId', requireSession, removeFavorite)
router.put('/aliases/:exerciseId', requireSession, setAlias)
router.delete('/aliases/:exerciseId', requireSession, removeAlias)

export default router
