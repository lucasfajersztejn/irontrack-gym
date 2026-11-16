import mongoose from 'mongoose';

/** Exercise inside a routine template */
const routineExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true,
  },

  order: { type: Number, required: true, min: 0 },

  targetSets: { type: Number, default: 3, min: 1, max: 20 },

  targetReps:        { type: Number, min: 0 },
  targetWeightKg:    { type: Number, min: 0 },
  targetDurationSec: { type: Number, min: 0 },
  targetDistanceM:   { type: Number, min: 0 },

  barWeightKg: { type: Number, min: 0, max: 50, default: null },

  groupId: { type: String, default: null, trim: true, maxlength: 64 },

  notes: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const routineSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  name: { type: String, required: true, trim: true, maxlength: 60 },

  description: { type: String, trim: true, maxlength: 500 },

  exercises: {
    type: [routineExerciseSchema],
    validate: {
      validator: (v) => v.length > 0,
      message: 'Una rutina necesita al menos un ejercicio',
    },
  },

  isSystemTemplate: { type: Boolean, default: false },

  timesUsed: { type: Number, default: 0, min: 0 },

  lastUsedAt: { type: Date, default: null },

  order: { type: Number, default: 0, min: 0 },

  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
    index: true,
  },

  starsCount: { type: Number, default: 0, min: 0, index: true },

}, { timestamps: true });

// Indexes

/** "My routines" list, recently used first */
routineSchema.index({ user: 1, lastUsedAt: -1 });

/** "My routines" list in manual order */
routineSchema.index({ user: 1, order: 1 });

/** System templates for onboarding */
routineSchema.index(
  { isSystemTemplate: 1 },
  { partialFilterExpression: { isSystemTemplate: true } },
);

export default mongoose.model('Routine', routineSchema);
