import Exercise from '../models/Exercise.js'

export const getExercises = async (req, res) => {
  try {
    const { muscle, bodyPart, equipment, search } = req.query

    const filter = {}
    if (muscle) filter.muscle = { $regex: muscle, $options: 'i' }
    if (bodyPart) filter.bodyPart = { $regex: bodyPart, $options: 'i' }
    if (equipment) filter.equipment = { $regex: equipment, $options: 'i' }
    if (search) filter.name = { $regex: search, $options: 'i' }

    const exercises = await Exercise.find(filter).sort({ name: 1 })
    res.json(exercises)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getBodyParts = async (req, res) => {
  try {
    const bodyParts = await Exercise.distinct('bodyPart')
    res.json(bodyParts.sort())
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMuscles = async (req, res) => {
  try {
    const muscles = await Exercise.distinct('muscle')
    res.json(muscles.sort())
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id)
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}