import dns from 'dns'

// Algunas redes locales no resuelven los SRV de MongoDB Atlas con el resolver
// del sistema. Esta variable fuerza DNS de Google e IPv4 primero. No se activa
// en servidores donde la salida UDP a 8.8.8.8 esté bloqueada (Fly.io, algunos
// contenedores PaaS).
if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import connectDB from './config/db.js'
import exerciseRoutes from './routes/exerciseRoutes.js'

connectDB()

const app = express()

app.use(helmet())

// CORS por whitelist. CORS_ORIGINS = "http://localhost:5173,https://irontrack.app".
// Sin la variable, bloquea cross-origin: evita el wildcard por defecto.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite peticiones same-origin (sin header Origin: Postman, SSR, health check).
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error(`Origen no permitido: ${origin}`))
    },
    credentials: true,
  })
)

app.use(express.json({ limit: '100kb' }))

// Rate limit global suave. Los endpoints sensibles (auth, mail) añadirán el suyo.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

app.use('/api/exercises', exerciseRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'IronTrack API' })
})

// Error handler central. En producción no filtra el stack.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500
  const payload = { message: err.message || 'Error interno' }
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack
  }
  res.status(status).json(payload)
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})

export default app
