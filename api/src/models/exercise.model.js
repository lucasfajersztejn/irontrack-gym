import mongoose from 'mongoose';
import {
  MUSCLES, BODY_PARTS, EQUIPMENT, CATEGORIES, TRACKING_TYPES,
  BAR_EQUIPMENT, DEFAULT_BAR_WEIGHTS_KG,
} from './constants.js';

/** Bilingual text (es/en) */
const localizedStringSchema = new mongoose.Schema({
  es: { type: String, trim: true },
  en: { type: String, trim: true },
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
  slug: { type: String, required: true, trim: true, lowercase: true },

  name: {
    type: localizedStringSchema,
    required: true,
    validate: {
      validator: (v) => Boolean(v?.es || v?.en),
      message: 'El ejercicio necesita nombre en al menos un idioma',
    },
  },

  // Classification

  muscle: { type: String, required: true, enum: MUSCLES, index: true },

  bodyPart:  { type: String, enum: BODY_PARTS },
  equipment: { type: String, enum: EQUIPMENT, default: 'other' },
  category:  { type: String, enum: CATEGORIES, default: 'strength' },

  secondaryMuscles: [{ type: String, enum: MUSCLES }],

  instructions: {
    es: [{ type: String }],
    en: [{ type: String }],
  },

  gifUrl: { type: String, trim: true, default: null },

  // How the exercise is tracked

  tracking: {
    type: String,
    required: true,
    enum: TRACKING_TYPES,
    default: 'weight_reps',
  },

  usesBar: { type: Boolean, default: false },

  defaultBarWeightKg: { type: Number, default: null, min: 0 },

  // Ownership

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
    index: true,
  },

  copiesCount: { type: Number, default: 0, min: 0, index: true },

}, { timestamps: true });

// Hooks

exerciseSchema.pre('validate', function (next) {
  if (this.isModified('equipment') || this.isNew) {
    this.usesBar = BAR_EQUIPMENT.includes(this.equipment);
    this.defaultBarWeightKg = this.usesBar
      ? (DEFAULT_BAR_WEIGHTS_KG[this.equipment] ?? 20)
      : null;
  }
  next();
});

// Indexes

/** Unique slug per owner (global catalog or user) */
exerciseSchema.index({ slug: 1, createdBy: 1 }, { unique: true });

/** Catalog search by muscle and equipment */
exerciseSchema.index({ muscle: 1, equipment: 1 });

/** Bilingual text search on names */
exerciseSchema.index({ 'name.es': 'text', 'name.en': 'text' });

export default mongoose.model('Exercise', exerciseSchema);
