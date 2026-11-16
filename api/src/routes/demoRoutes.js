import express from 'express'
import rateLimit from 'express-rate-limit'
import { demoLogin } from '../controllers/demoController.js'

// Strict per-IP rate limit for demo login
const demoLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de la cuenta demo. Espera un minuto.' },
})

const router = express.Router()

router.post('/', demoLoginLimiter, demoLogin)

export default router
