import mongoose from 'mongoose'

const workoutSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  duration: { type: Number },
  notes: { type: String },
}, { timestamps: true })

export default mongoose.model('Workout', workoutSchema)