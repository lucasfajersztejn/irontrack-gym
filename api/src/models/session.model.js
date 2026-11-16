import mongoose from 'mongoose';
import { MUSCLES, TRACKING_TYPES } from './constants.js';

/** One set inside a session entry */
const setSchema = new mongoose.Schema({
  order: { type: Number, required: true, min: 0 },

  weightKg:      { type: Number, min: 0 },
  reps:          { type: Number, min: 0 },
  addedWeightKg: { type: Number, min: 0 },
  durationSec:   { type: Number, min: 0 },
  distanceM:     { type: Number, min: 0 },

  rir:       { type: Number, min: 0, max: 5, validate: Number.isInteger },
  completed: { type: Boolean, default: false },
  restSec:   { type: Number, min: 0 },

}, { _id: false });

const entrySchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true,
  },

  exerciseName: { type: String, required: true, trim: true, maxlength: 100 },
  muscle:       { type: String, required: true, enum: MUSCLES },
  tracking:     { type: String, required: true, enum: TRACKING_TYPES },

  order: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 500 },

  groupId: { type: String, default: null, trim: true, maxlength: 64 },

  barWeightKg: { type: Number, min: 0, max: 50, default: null },

  sets: { type: [setSchema], default: [] },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  routine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine',
    default: null,
  },

  routineName: { type: String, trim: true, maxlength: 60, default: null },

  startedAt: { type: Date, required: true },
  endedAt:   { type: Date, default: null },

  timeZone: { type: String, default: null, trim: true, maxlength: 64 },

  durationEstimated: { type: Boolean, default: false },

  entries: { type: [entrySchema], default: [] },

  notes: { type: String, trim: true, maxlength: 1000 },

}, { timestamps: true });

// Cross validation: coherent endedAt and complete sets per tracking

const REQUIRED_SET_FIELDS = {
  weight_reps:   ['weightKg', 'reps'],
  reps:          ['reps'],
  time:          ['durationSec'],
  distance_time: ['distanceM', 'durationSec'],
};

sessionSchema.pre('validate', function (next) {
  if (this.endedAt && this.endedAt < this.startedAt) {
    return next(new Error('endedAt no puede ser anterior a startedAt'));
  }

  for (const entry of this.entries) {
    const required = REQUIRED_SET_FIELDS[entry.tracking] || [];
    for (const set of entry.sets) {
      for (const field of required) {
        if (set[field] == null) {
          return next(new Error(
            `Entry ${entry.order} / set ${set.order}: falta "${field}" para tracking "${entry.tracking}"`,
          ));
        }
      }
    }
  }

  next();
});

// Virtual: computed duration

sessionSchema.virtual('durationSec').get(function () {
  if (!this.endedAt) return null;
  return Math.round((this.endedAt - this.startedAt) / 1000);
});

sessionSchema.set('toJSON',   { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

// Indexes

/** My sessions by date, newest first */
sessionSchema.index({ user: 1, startedAt: -1 });

export default mongoose.model('Session', sessionSchema);
