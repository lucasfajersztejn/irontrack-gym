import { makeSignature } from 'better-auth/crypto'
import { auth } from '../config/auth.js'
import User from '../models/user.model.js'
import { DEMO_ACCOUNT } from '../models/constants.js'

// Demo account login, no OAuth
export async function demoLogin(req, res, next) {
  try {
    const demo = await User.findOne({ email: DEMO_ACCOUNT.email }).select('_id').lean()
    if (!demo) {
      return res.status(503).json({
        message: 'La cuenta demo no existe todavía. Ejecuta `npm run seed:demo` en el servidor.',
      })
    }

    const ctx = await auth.$context

    const session = await ctx.internalAdapter.createSession(String(demo._id), false)

    await setSessionCookie(res, ctx, session.token)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}

async function setSessionCookie(res, ctx, token) {
  const { name, attributes } = ctx.authCookies.sessionToken
  const signature = await makeSignature(token, ctx.secret)
  const { maxAge: _ignored, ...cookieAttributes } = attributes
  res.cookie(name, `${token}.${signature}`, {
    ...cookieAttributes,
    maxAge: ctx.sessionConfig.expiresIn * 1000,
  })
}
