import 'dotenv/config'
import dns from 'dns'

// Algunas redes locales no resuelven los SRV de MongoDB Atlas con el resolver
// del sistema. Esta variable fuerza DNS de Google e IPv4 primero. No se activa
// en servidores donde la salida UDP a 8.8.8.8 esté bloqueada (Fly.io, algunos
// contenedores PaaS).
if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { toNodeHandler } from 'better-auth/node'
import connectDB from './config/db.js'
import { auth } from './config/auth.js'
import exerciseRoutes from './routes/exerciseRoutes.js'
import userRoutes from './routes/userRoutes.js'
import routineRoutes from './routes/routineRoutes.js'

connectDB()

const app = express()

app.use(helmet())

// CORS por whitelist. CORS_ORIGINS = "http://localhost:5173,https://irontrack.app".
// Sin la variable, bloquea cross-origin: evita el wildcard por defecto.
//
// Añadimos la URL propia (BETTER_AUTH_URL) a la lista: Chrome inyecta el header
// Origin incluso en POST same-origin, así que si no lo permitimos explícitamente
// el propio servidor no puede llamar a sus endpoints desde una pestaña del
// navegador (p.ej. para pruebas desde DevTools antes de que haya frontend).
// Es seguro porque un atacante no puede falsificar la URL del propio servidor.
const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  process.env.BETTER_AUTH_URL,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      // Permite peticiones same-origin (sin header Origin: Postman, SSR, health check).
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error(`Origen no permitido: ${origin}`))
    },
    // Las sesiones de Better Auth viajan en cookie, así que CORS tiene que
    // permitir credentials o el navegador no envía la cookie a la API.
    credentials: true,
  })
)

// Rate limit global suave. Los endpoints sensibles (auth, mail) añadirán el suyo.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

/**
 * IMPORTANTE: el handler de Better Auth va ANTES de `express.json()`.
 *
 * Better Auth lee el request como un stream (API Fetch estándar: `request.body`
 * se consume una sola vez). Si `express.json()` lo lee primero para poblar
 * `req.body`, Better Auth recibe un stream vacío y los POST (callbacks OAuth,
 * sign-out, etc.) rompen. La doc de Better Auth lo advierte explícitamente.
 */
app.all('/api/auth/*', toNodeHandler(auth))

app.use(express.json({ limit: '100kb' }))

app.use('/api/exercises', exerciseRoutes)
app.use('/api/me', userRoutes)
app.use('/api/routines', routineRoutes)

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
