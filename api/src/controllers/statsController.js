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

// ---------------------------------------------------------------------------
// GET /api/stats/records
// ---------------------------------------------------------------------------

/**
 * All-time PRs por ejercicio tocado por el usuario. Para cada ejercicio
 * con al menos una serie `completed`, devuelve el máximo histórico de
 * `heaviestKg`, `best1RM` y `bestReps`, cada uno con la fecha de la
 * sesión en que se consiguió.
 *
 * Alcance deliberado:
 *   - Solo ejercicios tocados. Un "récord" en un ejercicio que el
 *     usuario nunca ha hecho es ruido; tocarlos implícitamente filtra.
 *   - Solo `weight_reps` y `reps` (misma razón que /exercises/recent-prs:
 *     cardio no tiene métrica comparable sin un modelo que no existe).
 *   - Un ejercicio puede tener los tres valores (p. ej. press banca
 *     genera heaviestKg y best1RM; dominadas asistidas con peso añadido
 *     entran como `reps` y solo pueblan bestReps). El cliente decide
 *     cuál es el "principal" según tracking.
 *
 * Implementación: walk cronológico en JS en vez de aggregation.
 *   - Aggregation daría el max por ejercicio en una pasada, pero
 *     obtener la fecha EXACTA en que se logró ese max pide un $sort
 *     + $group con $first por métrica — tres pipelines paralelas o
 *     un $reduce pesado. Ninguna más legible.
 *   - El walk reusa el patrón de /exercises/recent-prs y da la fecha
 *     gratis. Con N sesiones (decenas, no miles para un usuario real)
 *     es O(N·sets) en memoria, trivial.
 */
export const getRecords = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    // Solo los campos que el walk consume. El payload se infla rápido
    // si traemos entries completos (sets con RIR, notas, etc.).
    const sessions = await Session.find({ user: userId })
      .select(
        'startedAt entries.exercise entries.exerciseName entries.muscle entries.tracking entries.sets',
      )
      .sort({ startedAt: 1 })
      .lean()

    // Map<exerciseId, record>. El record se crea perezosamente la primera
    // vez que aparece un ejercicio en una serie completed válida: así
    // "solo ejercicios tocados" cae por construcción.
    const byExercise = new Map()

    function ensure(exId, meta) {
      let rec = byExercise.get(exId)
      if (!rec) {
        rec = {
          exerciseId: exId,
          exerciseName: meta.exerciseName ?? null,
          muscle: meta.muscle ?? null,
          tracking: meta.tracking ?? null,
          heaviestKg: null,
          best1RM: null,
          bestReps: null,
        }
        byExercise.set(exId, rec)
      }
      return rec
    }

    for (const session of sessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps' && entry.tracking !== 'reps') continue
        const exId = entry.exercise?.toString()
        if (!exId) continue

        for (const set of entry.sets ?? []) {
          if (!set.completed) continue

          const rec = ensure(exId, entry)

          if (entry.tracking === 'weight_reps') {
            const w = set.weightKg ?? 0
            const r = set.reps ?? 0

            if (w > 0 && (rec.heaviestKg == null || w > rec.heaviestKg.value)) {
              rec.heaviestKg = { value: w, achievedAt: session.startedAt }
            }
            if (w > 0 && r > 0) {
              const e1rm = Math.round(w * (1 + r / 30) * 10) / 10
              if (rec.best1RM == null || e1rm > rec.best1RM.value) {
                rec.best1RM = { value: e1rm, achievedAt: session.startedAt }
              }
            }
          } else {
            const r = set.reps ?? 0
            if (r > 0 && (rec.bestReps == null || r > rec.bestReps.value)) {
              rec.bestReps = { value: r, achievedAt: session.startedAt }
            }
          }
        }
      }
    }

    // latestAt = el PR más reciente del ejercicio. Sirve para ordenar
    // la lista por "qué récord cayó último" sin que el cliente tenga
    // que recalcularlo.
    const records = Array.from(byExercise.values()).map((rec) => {
      const dates = [rec.heaviestKg, rec.best1RM, rec.bestReps]
        .filter(Boolean)
        .map((p) => new Date(p.achievedAt).getTime())
      const latestAt = dates.length ? new Date(Math.max(...dates)).toISOString() : null
      return { ...rec, latestAt }
    })

    records.sort((a, b) => {
      if (!a.latestAt) return 1
      if (!b.latestAt) return -1
      return new Date(b.latestAt) - new Date(a.latestAt)
    })

    res.json({ records })
  } catch (err) {
    next(err)
  }
}
