/**
 * Backfill de insignias sobre la historia existente.
 *
 * El motor se dispara al cerrar cada sesión, pero las sesiones que YA están
 * cerradas nunca pasaron por él. Este script recorre a cada usuario con
 * historial y evalúa sus insignias una vez. Es idempotente (índice único
 * {user, badge}), así que correrlo de más no duplica desbloqueos.
 *
 * Correr DESPUÉS de `npm run seed:badges`: sin catálogo no hay nada que ganar.
 *
 * Uso:  npm run backfill:badges
 */

import dns from 'dns'

if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Session from '../models/session.model.js'
import { evaluateAndPersist } from '../lib/badgeEngine.js'

async function run() {
  await connectDB()

  // Usuarios con al menos una sesión cerrada: no tiene sentido evaluar a quien
  // no tiene historial que puntuar.
  const userIds = await Session.distinct('user', { endedAt: { $ne: null } })
  console.log(`[backfill:badges] ${userIds.length} usuarios con historial.`)

  let totalUnlocked = 0
  for (const userId of userIds) {
    const unlocked = await evaluateAndPersist(userId)
    if (unlocked.length > 0) {
      totalUnlocked += unlocked.length
      console.log(
        `  · ${userId}: +${unlocked.length} (${unlocked.map((b) => b.slug).join(', ')})`,
      )
    }
  }

  console.log(`[backfill:badges] ${totalUnlocked} insignias desbloqueadas en total.`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('[backfill:badges] error:', err)
  process.exit(1)
})
