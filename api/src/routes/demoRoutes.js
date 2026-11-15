import express from 'express'
import rateLimit from 'express-rate-limit'
import { demoLogin } from '../controllers/demoController.js'

/*
  Límite propio y estricto para el login demo: 10 por minuto y por IP. El global
  de 120/min es para la API en general; este endpoint crea sesiones reales, así
  que un bucle de peticiones no debería poder llenar la colección de sesiones.

  Se monta en index.js ANTES del handler de Better Auth (`/api/auth/*`), que
  respondería 404 a cualquier ruta que no conozca.
*/
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
