import mongoose from 'mongoose';

/**
 * Un ejercicio dentro de una PLANTILLA.
 *
 * Fíjate en que aquí todo es "target": son intenciones, no hechos. Los números
 * reales (lo que de verdad levantaste el martes) viven en session.model.js.
 * Esta es la distinción más importante de todo el modelo de datos.
 */
const routineExerciseSchema = new mongoose.Schema({
  exercise: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exercise',
    required: true,
  },

  order: { type: Number, required: true, min: 0 },

  targetSets: { type: Number, default: 3, min: 1, max: 20 },

  // Opcionales porque dependen del tracking: un ejercicio de cinta no tiene
  // reps objetivo, tiene minutos.
  targetReps:        { type: Number, min: 0 },
  targetWeightKg:    { type: Number, min: 0 },
  targetDurationSec: { type: Number, min: 0 },
  targetDistanceM:   { type: Number, min: 0 },

  /**
   * Peso de la barra que el usuario planea usar en esta rutina para este
   * ejercicio. Solo aplica a ejercicios con barra olímpica (`equipment ===
   * 'barbell'`): la olímpica varía por gimnasio (15, 20, 25 kg) y el
   * usuario puede querer dejar constancia en la plantilla. Barra Z y Smith
   * tienen peso físico fijo definido por su propio equipamiento, no se
   * sobrescribe aquí.
   *
   * Null (default) = usa el peso baked del ejercicio (habitualmente 20 kg
   * para olímpica). La UI muestra placeholder "20" para delatarlo.
   */
  barWeightKg: { type: Number, min: 0, max: 50, default: null },

  /**
   * groupId: identificador compartido por los ejercicios que forman un
   * SUPERSERIE. Dos o más entradas con el mismo groupId se ejecutan como un
   * bloque — una serie de cada, luego la siguiente ronda, sin descanso
   * entre ejercicios dentro del bloque. null = ejercicio solo.
   *
   * El valor lo genera el cliente (crypto.randomUUID()); el servidor no
   * reparte IDs. Validamos SOLO que sea un string razonable: ni formato ni
   * longitud estricta, para no acoplarnos a una implementación concreta.
   * Si en el futuro queremos obligar UUID v4 o similar lo apretamos aquí.
   *
   * No es un ObjectId porque no referencia nada: es solo un identificador
   * de agrupación lógica. Entrevista: "sería una fk hacia una colección
   * Group que no tiene datos propios, no vale la pena crearla".
   */
  groupId: { type: String, default: null, trim: true, maxlength: 64 },

  notes: { type: String, trim: true, maxlength: 500 },
}, { _id: false });

const routineSchema = new mongoose.Schema({
  /**
   * null en las plantillas del sistema (Full Body, PPL, Upper/Lower), que son
   * de todos y las ve cualquier usuario nuevo.
   */
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

  /** Plantilla del sistema: se ofrece al usuario nuevo para que no vea una
   *  pantalla vacía. El usuario no puede editarlas, pero sí duplicarlas. */
  isSystemTemplate: { type: Boolean, default: false },

  /**
   * Cuántas veces se ha usado. Sirve para ordenar "mis rutinas" por las más
   * usadas en vez de alfabéticamente, que es lo que la gente espera.
   * Lo incrementa el servicio al crear una sesión a partir de esta rutina.
   */
  timesUsed: { type: Number, default: 0, min: 0 },

  lastUsedAt: { type: Date, default: null },

  /**
   * Visibilidad de la rutina de cara al resto del mundo.
   *
   *   "private" (default) — solo la ve y usa su dueño. Es el estado hoy.
   *   "public"            — se expone en el futuro buscador de rutinas y
   *                         otros usuarios pueden "forkearla" (crear su propia
   *                         copia privada) y marcarla con estrella.
   *
   * El campo se declara ya aunque los endpoints sociales llegan en Fase 3:
   * dejarlo sembrado evita migrar la colección entera para añadirlo cuando
   * haya rutinas vivas, y permite que cualquier consulta nueva filtre por
   * visibility desde el día uno.
   */
  visibility: {
    type: String,
    enum: ['private', 'public'],
    default: 'private',
    index: true,
  },

  /**
   * Contador denormalizado de estrellas (patrón GitHub).
   *
   * Se mantendrá con $inc al star/unstar — no se recalcula contando documentos
   * cada vez porque esa consulta no escala. La fuente de verdad vivirá en la
   * colección `routineStars` (una fila por par user+routine, único compuesto)
   * que se añadirá en Fase 3; este contador existe para poder ordenar el
   * buscador de rutinas públicas por popularidad sin un $lookup por página.
   */
  starsCount: { type: Number, default: 0, min: 0, index: true },

}, { timestamps: true });

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

/**
 * La consulta real de la pantalla "mis rutinas": las de este usuario, las
 * usadas hace poco primero. El -1 significa descendente, que es el orden en
 * que se van a pedir.
 */
routineSchema.index({ user: 1, lastUsedAt: -1 });

/** Para cargar las plantillas del sistema en el onboarding. */
routineSchema.index(
  { isSystemTemplate: 1 },
  { partialFilterExpression: { isSystemTemplate: true } },
);

export default mongoose.model('Routine', routineSchema);
