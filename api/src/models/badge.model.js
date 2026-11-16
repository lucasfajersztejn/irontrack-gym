import mongoose from 'mongoose';
import {
  BADGE_CATEGORIES,
  BADGE_TIERS,
  BADGE_RULE_TYPES,
  BADGE_RULE_OPERATORS,
} from './constants.js';

/** Badge catalog, defined by the app */
const ruleSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, enum: BADGE_RULE_TYPES },
    operator: { type: String, required: true, enum: BADGE_RULE_OPERATORS },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const localizedSchema = new mongoose.Schema(
  {
    es: { type: String, required: true, trim: true, maxlength: 80 },
    en: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const badgeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, maxlength: 60 },

    name: { type: localizedSchema, required: true },
    description: { type: localizedSchema, required: true },

    category: { type: String, required: true, enum: BADGE_CATEGORIES },
    tier: { type: String, required: true, enum: BADGE_TIERS },

    iconUrl: { type: String, trim: true, default: null },

    rule: { type: ruleSchema, required: true },
  },
  { timestamps: true },
);

// Seed upsert by slug
badgeSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Badge', badgeSchema);
