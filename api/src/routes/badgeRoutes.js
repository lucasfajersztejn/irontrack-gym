import express from 'express'
import { requireSession } from '../middleware/requireSession.js'
import { getBadges } from '../controllers/badgeController.js'

// El muro de insignias es privado: cada usuario ve su propio progreso. La
// exposición pública (perfiles de Fase 3) será un endpoint distinto que filtre
// por toPublicJSON, no este.
const router = express.Router()
router.use(requireSession)

router.get('/', getBadges)

export default router
