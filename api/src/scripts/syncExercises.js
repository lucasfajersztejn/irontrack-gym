import dns from 'dns'
dns.setDefaultResultOrder('ipv4first')
dns.setServers(['8.8.8.8', '8.8.4.4'])

import dotenv from 'dotenv'
dotenv.config()

import mongoose from 'mongoose'
import Exercise from '../models/Exercise.js'

const WORKOUTX_API_URL = 'https://api.workoutxapp.com/v1/exercises'
const WORKOUTX_API_KEY = process.env.WORKOUTX_API_KEY

const syncExercises = async () => {
  try {
    console.log('Conectando a MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Conectado!\n')

    const totalInDB = await Exercise.countDocuments()
    const startOffset = totalInDB
    console.log(`Ejercicios en DB: ${totalInDB} — retomando desde offset=${startOffset}\n`)

    let offset = startOffset
    const limit = 10
    let total = null
    let created = 0

    while (true) {
      console.log(`Fetching offset=${offset}...`)
      const response = await fetch(`${WORKOUTX_API_URL}?limit=${limit}&offset=${offset}`, {
        headers: { 'X-WorkoutX-Key': WORKOUTX_API_KEY },
      })

      if (!response.ok) {
        throw new Error(`Error de API: ${response.status} ${response.statusText}`)
      }

      const json = await response.json()
      total = json.total
      const exercises = json.data

      if (!exercises || exercises.length === 0) break

      // Guardar inmediatamente en MongoDB
      for (const exercise of exercises) {
        await Exercise.findOneAndUpdate(
          { externalId: exercise.id },
          {
            externalId: exercise.id,
            name: exercise.name,
            muscle: exercise.target,
            bodyPart: exercise.bodyPart,
            equipment: exercise.equipment || '',
            secondaryMuscles: exercise.secondaryMuscles || [],
            instructions: exercise.instructions || [],
            gifUrl: exercise.gifUrl || '',
          },
          { upsert: true, new: true }
        )
        created++
      }

      const totalInDBNow = await Exercise.countDocuments()
      console.log(`  → Guardados en DB: ${totalInDBNow} / ${total}`)

      if (totalInDBNow >= total) break
      offset += limit

      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`\n✅ Sync completo — ${created} ejercicios procesados`)
    process.exit(0)
  } catch (error) {
    console.error(`❌ Error en sync (offset=${error.offset || '?'}): ${error.message}`)
    console.log('Podés retomar ejecutando npm run sync:exercises de nuevo')
    process.exit(1)
  }
}

syncExercises()