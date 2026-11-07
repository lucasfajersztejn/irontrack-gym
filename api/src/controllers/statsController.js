import mongoose from 'mongoose'
import Session from '../models/session.model.js'
import { MUSCLES } from '../models/constants.js'

/*
  Stats: agregaciones globales por usuario que no caben en un controller
  concreto (sesiones, ejercicios, rutinas). El nombre del archivo abraza
  el crecimiento futuro — próximo estímulo sugerido, métricas semana a
  semana, etc. Hoy solo vive aquí `muscle-recency`.
*/

// Cardio sí es un `tracking` válido en el catálogo, pero muscleShapes.js no
// tiene silueta para él (no hay un músculo "cardio" en el cuerpo humano).
// Lo excluimos de la respuesta por simetría con lo que la UI puede pintar.
const PAINTABLE_MUSCLES = MUSCLES.filter((m) => m !== 'cardio')

// ---------------------------------------------------------------------------
// GET /api/stats/muscle-recency
// ---------------------------------------------------------------------------

/**
 * Para cada músculo, devuelve la fecha del último estímulo PRIMARIO del
 * usuario (= aparece como `entries.muscle` en una sesión con al menos una
 * serie `completed`). El cliente usa estos timestamps para pintar el mapa
 * en modo "Recuperación" (<72 h) o "Descuidado" (≥14 d o nunca).
 *
 * Decisiones de alcance:
 *   - Solo estímulo primario. Modelar secundarios como entrenamiento válido
 *     pide atribuirles un peso (medio toque de bíceps en un press banca
 *     ≠ hacer bíceps) y esa capa queda fuera por ahora. Un músculo que
 *     el usuario solo trabaja como secundario aparecerá como "nunca
 *     trabajado", que es honesto.
 *   - Sin ventana temporal en la respuesta. El threshold (72 h / 14 d) es
 *     decisión de producto y vive en el cliente. El endpoint se mantiene
 *     neutral: "aquí tienes el último, decide tú".
 *   - Claves presentes para todos los muscle ids paintables aunque nunca
 *     se hayan trabajado (con `null`). Evita que el cliente tenga que
 *     fusionar la respuesta con la lista completa de músculos.
 *   - `now` servido con la respuesta: el cliente no mezcla su reloj local
 *     con los `lastAt` del servidor al calcular diferencias.
 */
export const getMuscleRecency = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const rows = await Session.aggregate([
      { $match: { user: userId } },
      { $unwind: '$entries' },
      { $unwind: '$entries.sets' },
      { $match: { 'entries.sets.completed': true } },
      {
        $group: {
          _id: '$entries.muscle',
          lastAt: { $max: '$startedAt' },
        },
      },
    ])

    const byMuscle = {}
    for (const m of PAINTABLE_MUSCLES) byMuscle[m] = null
    for (const row of rows) {
      // Si llega un muscle id que no está en la lista paintable (p. ej.
      // 'cardio' si alguien lo marca así en una entry), lo ignoramos —
      // el cliente no sabría pintarlo.
      if (row._id && byMuscle[row._id] !== undefined) {
        byMuscle[row._id] = row.lastAt
      }
    }

    res.json({
      now: new Date().toISOString(),
      byMuscle,
    })
  } catch (err) {
    next(err)
  }
}
