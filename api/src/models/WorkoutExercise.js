import mongoose from 'mongoose'

const workoutExerciseSchema = new mongoose.Schema({
  workout: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  sets: [{
    reps: { type: Number },
    weight: { type: Number },
  }],
}, { timestamps: true })

export default mongoose.model('WorkoutExercise', workoutExerciseSchema)