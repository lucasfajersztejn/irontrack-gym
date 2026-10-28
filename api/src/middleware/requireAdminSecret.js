import crypto from 'crypto'

/**
 * Autoriza requests disparadas por un cron externo (Fly.io scheduled machines,
 * GitHub Actions, cron-job.org...). NO es la auth de usuarios: aquí no hay
 * sesión Better Auth porque el llamante no es un humano logueado, es una
 * máquina.
 *
 * Contrato:
 *   - Header `X-Admin-Secret: <token>` presente.
 *   - Coincide con `process.env.ADMIN_SECRET`.
 *   - Si la env var no está definida en el servidor, el endpoint queda
 *     cerrado: devolver 503 en vez de "permitir cualquier cosa por defecto"
 *     evita exponerlo por error en despliegues mal configurados.
 *
 * Comparación con `timingSafeEqual`: evita que un atacante infiera el prefijo
 * del secreto midiendo cuánto tarda el servidor en rechazar su guess. En este
 * endpoint concreto el riesgo real es bajo (una ruta, un consumidor), pero
 * es un patrón barato y bien visto en revisión de seguridad.
 */
export function requireAdminSecret(req, res, next) {
  const expected = process.env.ADMIN_SECRET
  if (!expected) {
    return res.status(503).json({
      message: 'Endpoint admin no configurado',
    })
  }

  const provided = req.get('X-Admin-Secret') || ''

  // timingSafeEqual exige buffers del mismo tamaño. Pre-chequeo de longitud:
  // si el guess es más corto o más largo, lo rechazamos sin comparar — pero
  // también sin filtrar el tamaño exacto del secreto (no devolvemos nada
  // distinto por longitudes diferentes).
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'No autorizado' })
  }

  next()
}
