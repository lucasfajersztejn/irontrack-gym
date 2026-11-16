import crypto from 'crypto'

/** Authorize cron-triggered requests via X-Admin-Secret */
export function requireAdminSecret(req, res, next) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return res.status(503).json({
      message: 'Endpoint admin no configurado',
    })
  }

  const provided = req.get('X-Admin-Secret') || ''

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'No autorizado' })
  }

  next()
}
