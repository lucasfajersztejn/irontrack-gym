import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  muscle: { type: String, required: true },
  bodyPart: { type: String },
  equipment: { type: String },
  secondaryMuscles: [{ type: String }],
  instructions: [{ type: String }],
  gifUrl: { type: String },
}, { timestamps: true })

export default mongoose.model('Exercise', exerciseSchema)