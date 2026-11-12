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
    // Antes "Centurión": ese nombre pasó a la insignia de 100 series (sets-100),
    // que es la lectura literal de centurión. La racha de 100 días ya se
    // describía como "Imparable", así que el nombre encaja sin inventar nada.
    name: { es: 'Imparable', en: 'Unstoppable' },
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

  // === Wave 1: métricas nuevas de Session (totalReps, totalSets,
  // maxSessionVolumeKg, maxSetsInSession, maxWeightSingleKg) ===

  // --- Hito de arranque ---
  {
    slug: 'first-session',
    name: { es: 'Primer paso', en: 'First step' },
    description: {
      es: 'Tu primera sesión registrada.',
      en: 'Your first logged session.',
    },
    category: 'hitos',
    tier: 'bronce',
    rule: { type: 'sessionCount', operator: 'gte', value: 1 },
  },

  // --- Volumen: primer peldaño y máximos en una sola sesión ---
  {
    slug: 'volume-1000',
    name: { es: 'Primera tonelada', en: 'First tonne' },
    description: {
      es: 'Mil kilos levantados en total.',
      en: 'One thousand kilos lifted in total.',
    },
    category: 'volumen',
    tier: 'bronce',
    rule: { type: 'totalVolumeKg', operator: 'gte', value: 1000 },
  },
  {
    slug: 'session-volume-500',
    name: { es: 'Media tonelada diaria', en: 'Half a tonne in a day' },
    description: {
      es: 'Quinientos kilos en una sola sesión.',
      en: 'Five hundred kilos in a single session.',
    },
    category: 'volumen',
    tier: 'bronce',
    rule: { type: 'maxSessionVolumeKg', operator: 'gte', value: 500 },
  },
  {
    slug: 'session-volume-1500',
    name: { es: 'Levanta un coche', en: 'Lift a car' },
    description: {
      es: 'Mil quinientos kilos en una sola sesión.',
      en: 'Fifteen hundred kilos in a single session.',
    },
    category: 'volumen',
    tier: 'plata',
    rule: { type: 'maxSessionVolumeKg', operator: 'gte', value: 1500 },
  },

  // --- Series acumuladas ---
  {
    slug: 'sets-100',
    name: { es: 'Centurión', en: 'Centurion' },
    description: {
      es: 'Cien series completadas en total.',
      en: 'One hundred sets completed in total.',
    },
    category: 'hitos',
    tier: 'plata',
    rule: { type: 'totalSets', operator: 'gte', value: 100 },
  },
  {
    slug: 'sets-1000',
    name: { es: 'Mil series', en: 'A thousand sets' },
    description: {
      es: 'Mil series completadas en total.',
      en: 'One thousand sets completed in total.',
    },
    category: 'hitos',
    tier: 'oro',
    rule: { type: 'totalSets', operator: 'gte', value: 1000 },
  },

  // --- Reps acumuladas ---
  {
    slug: 'reps-10000',
    name: { es: 'Maratón de reps', en: 'Rep marathon' },
    description: {
      es: 'Diez mil repeticiones completadas.',
      en: 'Ten thousand reps completed.',
    },
    category: 'hitos',
    tier: 'oro',
    rule: { type: 'totalReps', operator: 'gte', value: 10000 },
  },

  // --- Máximos en una sola sesión / serie ---
  {
    slug: 'session-sets-30',
    name: { es: 'Gran sesión', en: 'Big session' },
    description: {
      es: 'Treinta series en una sola sesión.',
      en: 'Thirty sets in a single session.',
    },
    category: 'hitos',
    tier: 'plata',
    rule: { type: 'maxSetsInSession', operator: 'gte', value: 30 },
  },
  {
    slug: 'weight-100',
    name: { es: 'Club de los 3 dígitos', en: 'Three-digit club' },
    description: {
      es: 'Cien kilos o más en una sola serie.',
      en: 'One hundred kilos or more in a single set.',
    },
    category: 'hitos',
    tier: 'oro',
    rule: { type: 'maxWeightSingleKg', operator: 'gte', value: 100 },
  },

  // === Wave 2: calendario (requiere timeZone por sesión + weeklyGoal) ===

  // --- Ritmo semanal: semanas CONSECUTIVAS cumpliendo la meta (weeklyGoal) ---
  {
    slug: 'goal-week-1',
    name: { es: 'Semana completa', en: 'Full week' },
    description: {
      es: 'Cumpliste tu meta semanal una semana.',
      en: 'You hit your weekly goal for a week.',
    },
    category: 'constancia',
    tier: 'bronce',
    rule: { type: 'maxGoalWeekStreak', operator: 'gte', value: 1 },
  },
  {
    slug: 'goal-week-4',
    name: { es: 'Ritmo perfecto', en: 'Perfect pace' },
    description: {
      es: 'Cuatro semanas seguidas cumpliendo tu meta.',
      en: 'Four weeks in a row hitting your goal.',
    },
    category: 'constancia',
    tier: 'plata',
    rule: { type: 'maxGoalWeekStreak', operator: 'gte', value: 4 },
  },
  {
    slug: 'goal-week-12',
    name: { es: 'Trimestre perfecto', en: 'Perfect quarter' },
    description: {
      es: 'Doce semanas seguidas cumpliendo tu meta.',
      en: 'Twelve weeks in a row hitting your goal.',
    },
    category: 'constancia',
    tier: 'oro',
    rule: { type: 'maxGoalWeekStreak', operator: 'gte', value: 12 },
  },

  // --- Meses naturales con al menos una sesión ---
  {
    slug: 'months-active-6',
    name: { es: 'Medio año activo', en: 'Half a year active' },
    description: {
      es: 'Entrenaste en seis meses distintos.',
      en: 'You trained across six different months.',
    },
    category: 'constancia',
    tier: 'plata',
    rule: { type: 'distinctActiveMonths', operator: 'gte', value: 6 },
  },
  {
    slug: 'months-active-12',
    name: { es: 'Año de hierro', en: 'Iron year' },
    description: {
      es: 'Entrenaste en doce meses distintos.',
      en: 'You trained across twelve different months.',
    },
    category: 'constancia',
    tier: 'oro',
    rule: { type: 'distinctActiveMonths', operator: 'gte', value: 12 },
  },

  // --- Fin de semana (día local, por eso necesita timeZone) ---
  {
    slug: 'weekend-10',
    name: { es: 'Fin de semana guerrero', en: 'Weekend warrior' },
    description: {
      es: 'Diez sesiones en sábado o domingo.',
      en: 'Ten sessions on a Saturday or Sunday.',
    },
    category: 'rareza',
    tier: 'plata',
    rule: { type: 'weekendSessions', operator: 'gte', value: 10 },
  },

  // --- Antigüedad de la cuenta (concepto y nombre nuevos; no toca 'Veterano') ---
  {
    slug: 'account-age-365',
    name: { es: 'Aniversario', en: 'Anniversary' },
    description: {
      es: 'Un año desde que creaste tu cuenta.',
      en: 'One year since you created your account.',
    },
    category: 'hitos',
    tier: 'oro',
    rule: { type: 'accountAgeDays', operator: 'gte', value: 365 },
  },

  // === Wave 3: hora local (madrugador/búho) + difusos del heatmap ===

  // --- Franja horaria (hora local de inicio) ---
  {
    slug: 'early-bird',
    name: { es: 'Madrugador', en: 'Early bird' },
    description: {
      es: 'Cinco sesiones empezadas antes de las 7.',
      en: 'Five sessions started before 7 a.m.',
    },
    category: 'rareza',
    tier: 'plata',
    rule: { type: 'earlyBirdSessions', operator: 'gte', value: 5 },
  },
  {
    slug: 'night-owl',
    name: { es: 'Búho nocturno', en: 'Night owl' },
    description: {
      es: 'Cinco sesiones empezadas a partir de las 22.',
      en: 'Five sessions started at 10 p.m. or later.',
    },
    category: 'rareza',
    tier: 'plata',
    rule: { type: 'nightOwlSessions', operator: 'gte', value: 5 },
  },

  // --- Heatmap: días distintos y semana completa ---
  {
    slug: 'active-days-100',
    name: { es: 'Contribución verde', en: 'Green contribution' },
    description: {
      es: 'Cien días distintos con sesión.',
      en: 'One hundred different days with a session.',
    },
    category: 'constancia',
    tier: 'oro',
    rule: { type: 'distinctActiveDays', operator: 'gte', value: 100 },
  },
  {
    slug: 'full-week',
    name: { es: 'Cuadrícula llena', en: 'Full grid' },
    description: {
      es: 'Los siete días de una semana con sesión.',
      en: 'All seven days of a week with a session.',
    },
    category: 'constancia',
    tier: 'plata',
    rule: { type: 'maxDaysInWeek', operator: 'gte', value: 7 },
  },

  // --- Vuelta tras un parón ---
  {
    slug: 'comeback',
    name: { es: 'Vuelta al ruedo', en: 'Back in the ring' },
    description: {
      es: 'Volviste tras treinta días sin entrenar.',
      en: 'You came back after thirty days away.',
    },
    category: 'rareza',
    tier: 'bronce',
    rule: { type: 'longestGapDays', operator: 'gte', value: 30 },
  },

  // --- Retención: primer mes de cuenta ---
  {
    slug: 'first-month',
    name: { es: 'Primer mes cumplido', en: 'First month done' },
    description: {
      es: 'Un mes desde que creaste tu cuenta.',
      en: 'One month since you created your account.',
    },
    category: 'hitos',
    tier: 'bronce',
    rule: { type: 'accountAgeDays', operator: 'gte', value: 30 },
  },

  // === Wave 5: variedad (grupos musculares y ejercicios) ===
  // Partes del cuerpo derivadas del músculo con MUSCLE_TO_BODY_PART (7 partes,
  // cardio incluido). Solo cuentan series completadas.
  {
    slug: 'body-parts-5',
    name: { es: 'Explorador', en: 'Explorer' },
    description: {
      es: 'Has entrenado cinco partes del cuerpo distintas.',
      en: 'You have trained five different body parts.',
    },
    category: 'variedad',
    tier: 'bronce',
    rule: { type: 'distinctBodyParts', operator: 'gte', value: 5 },
  },
  {
    slug: 'body-parts-all',
    name: { es: 'Cuerpo completo', en: 'Full body' },
    description: {
      es: 'Has entrenado las siete partes del cuerpo.',
      en: 'You have trained all seven body parts.',
    },
    category: 'variedad',
    tier: 'plata',
    rule: { type: 'distinctBodyParts', operator: 'gte', value: 7 },
  },
  // Seis partes distintas en una misma semana ISO (no confundir con 'full-week',
  // que mide días, no grupos).
  {
    slug: 'body-parts-week-6',
    name: { es: 'Full body day', en: 'Full body day' },
    description: {
      es: 'Seis partes del cuerpo distintas en una misma semana.',
      en: 'Six different body parts in a single week.',
    },
    category: 'variedad',
    tier: 'plata',
    rule: { type: 'maxBodyPartsInWeek', operator: 'gte', value: 6 },
  },
  {
    slug: 'exercises-25',
    name: { es: 'Curioso', en: 'Curious' },
    description: {
      es: 'Veinticinco ejercicios distintos probados.',
      en: 'Twenty-five different exercises tried.',
    },
    category: 'variedad',
    tier: 'bronce',
    rule: { type: 'distinctExercises', operator: 'gte', value: 25 },
  },
  {
    slug: 'exercises-100',
    name: { es: 'Catálogo abierto', en: 'Open catalog' },
    description: {
      es: 'Cien ejercicios distintos en tu historial.',
      en: 'One hundred different exercises in your history.',
    },
    category: 'variedad',
    tier: 'oro',
    rule: { type: 'distinctExercises', operator: 'gte', value: 100 },
  },
  // Las siete partes dentro de una misma ventana de 30 días: no hace falta
  // que sea la semana, sirve un mes cualquiera.
  {
    slug: 'all-parts-30d',
    name: { es: 'Sin favoritismos', en: 'No favorites' },
    description: {
      es: 'Las siete partes del cuerpo en un periodo de 30 días.',
      en: 'All seven body parts within a 30-day period.',
    },
    category: 'variedad',
    tier: 'oro',
    rule: { type: 'maxBodyPartsIn30DayWindow', operator: 'gte', value: 7 },
  },
  {
    slug: 'first-cardio',
    name: { es: 'Cardio también cuenta', en: 'Cardio counts too' },
    description: {
      es: 'Completa una sesión con cardio.',
      en: 'Complete a session that includes cardio.',
    },
    category: 'variedad',
    tier: 'bronce',
    rule: { type: 'cardioSessions', operator: 'gte', value: 1 },
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
