import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema({
  externalId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  muscle: { type: String, required: true },
  gifUrl: { type: String },
  equipment: { type: String },
}, { timestamps: true })

export default mongoose.model('Exercise', exerciseSchema)