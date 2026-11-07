import { beforeAll, afterAll, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

/**
 * Mongo en memoria para toda la suite.
 *
 * Alternativas descartadas:
 *   - Mockear mongoose: pierde el pre('validate') cruzado del session.model,
 *     que es exactamente lo que queremos verificar.
 *   - Atlas de pruebas: requiere credenciales en CI y tarda en responder.
 *   - Base local: añade dependencia de entorno; los tests dejan de ser
 *     reproducibles en un portátil nuevo.
 *
 * Un único servidor compartido por el run, con limpieza de colecciones entre
 * tests. Levantarlo una vez cuesta segundos; levantarlo por archivo cuesta
 * minutos y no aporta aislamiento real (cada test ya empieza con DB vacía).
 */
let mongod

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterEach(async () => {
  // Borra colecciones en vez de la base: mantiene índices creados por los
  // schemas (ej. unique de email) sin pagar el coste de redeclararlos.
  const { collections } = mongoose.connection
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({})
  }
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod?.stop()
})
