/**
 * Siembra el catálogo inicial de insignias (Fase 3, PR1).
 *
 * Upsert por `slug`: idempotente, correrlo dos veces no duplica y actualiza
 * textos/reglas si cambian. No toca `userBadges` — los desbloqueos del usuario
 * son otra colección.
 *
 * Cobertura de este primer lote: tres categorías con regla que el motor ya
 * sabe evaluar (constancia, hitos, volumen). `variedad` y `rareza` entran
 * cuando el motor aprenda sus métricas (grupos/mes y hora local).
 *
 * Uso:  npm run seed:badges
 */

import dns from 'dns'

if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import Badge from '../models/badge.model.js'

/*
  iconUrl queda null a propósito: el muro renderiza un hexágono genérico por
  categoría mientras no haya arte definitivo. Las cifras siguen los ejemplos
  de la spec (§6.4): rachas 7/30/100, volumen 10.000/100.000 kg.
*/
const BADGES = [
  // --- Constancia (racha de días consecutivos) ---
  {
    slug: 'streak-7',
    name: { es: 'Semana en racha', en: 'Week streak' },
    description: {
      es: 'Siete días seguidos con sesión.',
      en: 'Seven days in a row with a session.',
    },
    category: 'constancia',
    tier: 'bronce',
    rule: { type: 'streak', operator: 'gte', value: 7 },
  },
  {
    slug: 'streak-30',
    name: { es: 'Mes de hierro', en: 'Iron month' },
    description: {
      es: 'Treinta días seguidos entrenando.',
      en: 'Thirty days training in a row.',
    },
    category: 'constancia',
    tier: 'plata',
    rule: { type: 'streak', operator: 'gte', value: 30 },
  },
  {
    slug: 'streak-100',
    name: { es: 'Centurión', en: 'Centurion' },
    description: {
      es: 'Cien días consecutivos. Imparable.',
      en: 'One hundred days in a row. Unstoppable.',
    },
    category: 'constancia',
    tier: 'oro',
    rule: { type: 'streak', operator: 'gte', value: 100 },
  },

  // --- Hitos (número de sesiones cerradas) ---
  {
    slug: 'sessions-10',
    name: { es: 'Primeros diez', en: 'First ten' },
    description: {
      es: 'Diez sesiones completadas.',
      en: 'Ten sessions completed.',
    },
    category: 'hitos',
    tier: 'bronce',
    rule: { type: 'sessionCount', operator: 'gte', value: 10 },
  },
  {
    slug: 'sessions-50',
    name: { es: 'Habitual', en: 'Regular' },
    description: {
      es: 'Cincuenta sesiones a tus espaldas.',
      en: 'Fifty sessions behind you.',
    },
    category: 'hitos',
    tier: 'plata',
    rule: { type: 'sessionCount', operator: 'gte', value: 50 },
  },
  {
    slug: 'sessions-100',
    name: { es: 'Veterano', en: 'Veteran' },
    description: {
      es: 'Cien sesiones registradas.',
      en: 'One hundred sessions logged.',
    },
    category: 'hitos',
    tier: 'oro',
    rule: { type: 'sessionCount', operator: 'gte', value: 100 },
  },

  // --- Volumen (kg acumulados = peso × reps) ---
  {
    slug: 'volume-10000',
    name: { es: 'Diez toneladas', en: 'Ten tonnes' },
    description: {
      es: 'Diez mil kilos levantados en total.',
      en: 'Ten thousand kilos lifted in total.',
    },
    category: 'volumen',
    tier: 'bronce',
    rule: { type: 'totalVolumeKg', operator: 'gte', value: 10000 },
  },
  {
    slug: 'volume-100000',
    name: { es: 'Cien toneladas', en: 'Hundred tonnes' },
    description: {
      es: 'Cien mil kilos acumulados.',
      en: 'One hundred thousand kilos accumulated.',
    },
    category: 'volumen',
    tier: 'plata',
    rule: { type: 'totalVolumeKg', operator: 'gte', value: 100000 },
  },
  {
    slug: 'volume-500000',
    name: { es: 'Medio millón', en: 'Half a million' },
    description: {
      es: 'Medio millón de kilos movidos.',
      en: 'Half a million kilos moved.',
    },
    category: 'volumen',
    tier: 'oro',
    rule: { type: 'totalVolumeKg', operator: 'gte', value: 500000 },
  },
]

async function run() {
  await connectDB()
  let upserts = 0
  for (const badge of BADGES) {
    await Badge.updateOne({ slug: badge.slug }, { $set: badge }, { upsert: true })
    upserts += 1
  }
  console.log(`[seed:badges] ${upserts} insignias sembradas/actualizadas.`)
  await mongoose.disconnect()
}

run().catch((err) => {
  console.error('[seed:badges] error:', err)
  process.exit(1)
})
