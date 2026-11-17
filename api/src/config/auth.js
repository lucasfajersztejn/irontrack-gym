import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import Session from '../models/session.model.js'
import Routine from '../models/routine.model.js'
import Exercise from '../models/exercise.model.js'
import UserBadge from '../models/userBadge.model.js'
import { DEMO_ACCOUNT } from '../models/constants.js'

const mongoClient = new MongoClient(process.env.MONGO_URI)
await mongoClient.connect()
const db = mongoClient.db()

export const auth = betterAuth({
  database: mongodbAdapter(db),

  secret: process.env.BETTER_AUTH_SECRET,

  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: { enabled: false },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },

  user: {
    modelName: 'users',

    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        if (user.email?.toLowerCase() === DEMO_ACCOUNT.email) {
          throw new Error('La cuenta demo no se puede borrar')
        }
        await Promise.all([
          Session.deleteMany({ user: user.id }),
          Routine.deleteMany({ user: user.id }),
          Exercise.deleteMany({ createdBy: user.id }),
          UserBadge.deleteMany({ user: user.id }),
        ])
      },
    },
  },

  account: {
    modelName: 'accounts',

    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github'],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,

    freshAge: 0,
  },

  trustedOrigins: (process.env.CORS_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean),
})
