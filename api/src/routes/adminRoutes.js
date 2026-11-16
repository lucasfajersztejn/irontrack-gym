import express from 'express'
import { requireAdminSecret } from '../middleware/requireAdminSecret.js'
import { seedDemoUser } from '../scripts/seedDemoUser.js'

// Operator routes, protected by X-Admin-Secret
const router = express.Router()

router.post('/demo/reseed', requireAdminSecret, async (req, res, next) => {
  try {
    const summary = await seedDemoUser()
    res.json(summary)
  } catch (err) {
    next(err)
  }
})

export default router
