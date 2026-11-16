import mongoose from 'mongoose';

/** Badge unlocked by a user */
const userBadgeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
      required: true,
    },

    unlockedAt: { type: Date, required: true, default: Date.now },

    progress: { type: Number, default: null },
  },
  { timestamps: true },
);

// One unlock per user and badge
userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });

export default mongoose.model('UserBadge', userBadgeSchema);
