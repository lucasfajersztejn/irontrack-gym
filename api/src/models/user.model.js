import mongoose from 'mongoose';
import {
  LOCALES, PRIVACY_LEVELS,
  BAR_INPUT_MODES, RESERVED_USERNAMES,
} from './constants.js';

/** User preferences (subdocument) */
const settingsSchema = new mongoose.Schema({
  locale:  { type: String, enum: LOCALES,      default: 'es' },

  barInputMode: { type: String, enum: BAR_INPUT_MODES, default: 'plates' },

  defaultBarWeightKg: { type: Number, default: 20, min: 0, max: 50 },

  restTimerSec: { type: Number, default: 120, min: 0, max: 600 },

  weeklyGoal: { type: Number, default: 4, min: 1, max: 14 },

  suggestProgression: { type: Boolean, default: true },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Identity: fields Better Auth writes during OAuth

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  emailVerified: { type: Boolean, default: false },

  name:  { type: String, trim: true, maxlength: 50 },

  image: { type: String, trim: true },

  // Identity: IronTrack fields

  username: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-z0-9_-]+$/,
    validate: {
      validator: (v) => v === null || !RESERVED_USERNAMES.includes(v),
      message: 'Ese nombre de usuario no está disponible',
    },
  },

  // Settings

  settings: { type: settingsSchema, default: () => ({}) },

  privacy: { type: String, enum: PRIVACY_LEVELS, default: 'private' },

  favoriteExercises: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    default: [],
  }],

  exerciseAliases: {
    type: Map,
    of: { type: String, trim: true, minlength: 1, maxlength: 40 },
    default: () => new Map(),
  },

}, {
  timestamps: true,

  strict: false,
});

// Indexes

/** Unique username (partial: only string usernames) */
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);

/** Public-user search */
userSchema.index(
  { username: 1, name: 1 },
  { partialFilterExpression: { privacy: 'public' } },
);

// Public serializer

userSchema.methods.toPublicJSON = function () {
  return {
    username:  this.username,
    name:      this.name,
    image:     this.image,
    createdAt: this.createdAt,
  };
};

/** Fixed collection name "users", shared with Better Auth */
export default mongoose.model('User', userSchema, 'users');
