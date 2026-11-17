import 'dotenv/config'
import dns from 'dns'

if (process.env.FORCE_IPV4_DNS === '1') {
  dns.setDefaultResultOrder('ipv4first')
  dns.setServers(['8.8.8.8', '8.8.4.4'])
}

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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
import sessionRoutes from './routes/sessionRoutes.js'
import statsRoutes from './routes/statsRoutes.js'
import badgeRoutes from './routes/badgeRoutes.js'
import demoRoutes from './routes/demoRoutes.js'
import adminRoutes from './routes/adminRoutes.js'

connectDB()

const app = express()

// Trust Fly's proxy so secure cookies and client IPs resolve correctly.
app.set('trust proxy', 1)

// Static client is served same-origin; GIFs still load from the jsDelivr CDN.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'https://cdn.jsdelivr.net',
          'https://*.googleusercontent.com',
          'https://avatars.githubusercontent.com',
        ],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
)

// Built frontend copied into ./public at image build time.
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')
const hasClient = fs.existsSync(path.join(clientDist, 'index.html'))

if (hasClient) {
  app.use(express.static(clientDist, { index: false, maxAge: '1y' }))
}

const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  process.env.BETTER_AUTH_URL,
].filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error(`Origen no permitido: ${origin}`))
    },
    credentials: true,
  })
)

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

app.use('/api/auth/demo', demoRoutes)
app.all('/api/auth/*', toNodeHandler(auth))

app.use(express.json({ limit: '100kb' }))

app.use('/api/exercises', exerciseRoutes)
app.use('/api/me', userRoutes)
app.use('/api/routines', routineRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/badges', badgeRoutes)
app.use('/api/admin', adminRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'IronTrack API' })
})

// SPA fallback: non-API GETs resolve to index.html for client-side routing.
if (hasClient) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

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
