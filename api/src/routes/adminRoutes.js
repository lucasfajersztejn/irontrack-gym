import express from 'express'
import { requireAdminSecret } from '../middleware/requireAdminSecret.js'
import { seedDemoUser } from '../scripts/seedDemoUser.js'

/*
  Rutas de operador, protegidas por `X-Admin-Secret` (el mismo patrón que el
  cron externo) y no por sesión: quien las llama es una máquina o un operador,
  no un usuario logueado.

  Reseed de la cuenta demo: borra sus datos y los vuelve a sembrar con la misma
  función que usa `npm run seed:demo`. Así un reseed desde aquí y el de la CLI
  producen exactamente los mismos datos.
*/
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
