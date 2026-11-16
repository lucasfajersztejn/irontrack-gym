import mongoose from 'mongoose'
import Badge from '../models/badge.model.js'
import UserBadge from '../models/userBadge.model.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import { computeUserMetrics, badgeProgress, SESSION_METRIC_SELECT } from '../lib/badgeEngine.js'
import { BADGE_CATEGORIES, BADGE_TIERS } from '../models/constants.js'

/** GET /api/badges: full badge catalog with the user's state */
export const getBadges = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const [badges, userBadges, sessions, user] = await Promise.all([
      Badge.find().lean(),
      UserBadge.find({ user: userId }).select('badge unlockedAt progress').lean(),
      Session.find({ user: userId, endedAt: { $ne: null } })
        .select(SESSION_METRIC_SELECT)
        .sort({ startedAt: 1 })
        .lean(),
      User.findById(userId).select('weeklyGoal createdAt').lean(),
    ])

    const metrics = computeUserMetrics(sessions, {
      weeklyGoal: user?.weeklyGoal,
      createdAt: user?.createdAt,
    })
    const unlockedByBadge = new Map(userBadges.map((ub) => [ub.badge.toString(), ub]))

    const catIndex = (c) => {
      const i = BADGE_CATEGORIES.indexOf(c)
      return i === -1 ? BADGE_CATEGORIES.length : i
    }
    const tierIndex = (t) => {
      const i = BADGE_TIERS.indexOf(t)
      return i === -1 ? BADGE_TIERS.length : i
    }

    const items = badges
      .map((b) => {
        const ub = unlockedByBadge.get(b._id.toString())
        const progress = badgeProgress(b, metrics)
        return {
          slug: b.slug,
          name: b.name,
          description: b.description,
          category: b.category,
          tier: b.tier,
          iconUrl: b.iconUrl ?? null,
          unlocked: Boolean(ub),
          unlockedAt: ub?.unlockedAt ?? null,
          progress: ub ? { ...progress, pct: 100 } : progress,
        }
      })
      .sort(
        (a, b) =>
          catIndex(a.category) - catIndex(b.category) ||
          tierIndex(a.tier) - tierIndex(b.tier) ||
          a.progress.target - b.progress.target,
      )

    res.json({
      badges: items,
      counts: {
        unlocked: items.filter((i) => i.unlocked).length,
        total: items.length,
      },
    })
  } catch (err) {
    next(err)
  }
}
