import mongoose from 'mongoose';
import { MUSCLES, TRACKING_TYPES } from './constants.js';

/**
 * Una SERIE concreta dentro de un ejercicio de la sesión.
 *
 * El esquema es plano: todos los campos que pueden existir en cualquier
 * tracking están declarados como opcionales, y la validación de "cuáles son
 * obligatorios ESTA vez" vive más abajo, en el pre('validate') de la sesión,
 * donde ya sabemos qué tracking tiene el entry padre.
 *
 * ¿Por qué no un discriminator por tracking? Son 4 variantes; un discriminator
 * añadiría una capa de polimorfismo que no se amortiza y complica el populate
 * y la validación. Un solo schema + un switch de 10 líneas se lee en entrevista.
 */
const setSchema = new mongoose.Schema({
  order: { type: Number, required: true, min: 0 },

  // Según tracking (validados abajo):
  weightKg:      { type: Number, min: 0 }, // weight_reps
  reps:          { type: Number, min: 0 }, // weight_reps, reps
  addedWeightKg: { type: Number, min: 0 }, // reps (cinturón de dominadas)
  durationSec:   { type: Number, min: 0 }, // time, distance_time
  distanceM:     { type: Number, min: 0 }, // distance_time

  // Comunes:
  rpe:       { type: Number, min: 1, max: 10 }, // esfuerzo percibido 1-10
  isWarmup:  { type: Boolean, default: false }, // no cuenta para récords
  completed: { type: Boolean, default: false }, // marcada con el check
  restSec:   { type: Number, min: 0 },          // descanso que SE tomó

}, { _id: false });

/**
 * Un EJERCICIO dentro de la sesión, con sus series.
 *
 * exerciseName y muscle van copiados aquí (denormalización) para que el
 * historial sobreviva a cambios en el catálogo: si el ejercicio se renombra o
 * se borra, lo que pasó un martes concreto se sigue leyendo. Además las
 * agregaciones de stats no necesitan un $lookup por cada entry.
 */
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

  sets: { type: [setSchema], default: [] },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  /**
   * De qué rutina salió. null = "sesión libre" (empezada sin cargar rutina).
   * Nota: la sesión es una COPIA independiente de la plantilla. Si mañana se
   * edita la rutina, lo que pasó aquí no se mueve.
   */
  routine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine',
    default: null,
  },

  // Nombre congelado por los mismos motivos que exerciseName.
  routineName: { type: String, trim: true, maxlength: 60, default: null },

  /**
   * Timestamps, no contadores. Un setInterval en el navegador se pierde al
   * bloquear el móvil o cerrar la pestaña: la duración DEBE poder recalcularse
   * desde dos puntos fijos. (Ver virtual `durationSec` más abajo.)
   */
  startedAt: { type: Date, required: true },
  endedAt:   { type: Date, default: null },

  /**
   * true = la sesión se cerró sola porque el usuario se olvidó de darle a
   * "terminar". Un job detrás cierra las sesiones abiertas > MAX_SESSION_HOURS,
   * fija endedAt y marca este flag para que el usuario sepa que esa duración
   * es orientativa.
   */
  durationEstimated: { type: Boolean, default: false },

  entries: { type: [entrySchema], default: [] },

  notes: { type: String, trim: true, maxlength: 1000 },

}, { timestamps: true });

// ---------------------------------------------------------------------------
// Validación cruzada: endedAt coherente + series completas por tracking
// ---------------------------------------------------------------------------

/**
 * Qué campos requiere cada tracking. Está en el modelo (y no en constants.js)
 * porque es LA regla de este esquema; otros archivos no la consumen.
 */
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
      // Un warmup puede ir con menos datos: lo típico es anotar la aproximación
      // sin exigir reps exactas. Lo omitimos de la validación estricta.
      if (set.isWarmup) continue;

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

// ---------------------------------------------------------------------------
// Virtual: duración calculada
// ---------------------------------------------------------------------------

/**
 * Se calcula al vuelo. Si guardáramos una columna `durationSec`, editar
 * endedAt sin recalcularla la dejaría mintiendo. Un dato derivado no se
 * persiste.
 */
sessionSchema.virtual('durationSec').get(function () {
  if (!this.endedAt) return null;
  return Math.round((this.endedAt - this.startedAt) / 1000);
});

sessionSchema.set('toJSON',   { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

/**
 * Consulta real: historial de MIS sesiones ordenadas por fecha descendente.
 * Mismo índice sirve para el heatmap (filtra rango de fechas) y para la
 * paginación de "mis entrenamientos".
 */
sessionSchema.index({ user: 1, startedAt: -1 });

export default mongoose.model('Session', sessionSchema);
