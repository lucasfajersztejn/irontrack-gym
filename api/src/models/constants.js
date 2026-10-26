/**
 * Valores compartidos por todos los modelos.
 *
 * ¿Por qué un archivo aparte? Para no repetir strings sueltos ("barbell",
 * "weight_reps") por media docena de ficheros. Si mañana añades un tipo de
 * tracking, lo cambias aquí y se actualiza en todas partes. Un string repetido
 * a mano en 5 sitios es un typo esperando a pasar.
 */

// ---------------------------------------------------------------------------
// Taxonomía del catálogo de ejercicios (viene de ExerciseGymGifsDB)
// ---------------------------------------------------------------------------

export const MUSCLES = [
  'abductors', 'abs', 'adductors', 'biceps', 'calves', 'cardio', 'delts',
  'forearms', 'glutes', 'hamstrings', 'lats', 'levator-scapulae', 'pectorals',
  'quads', 'serratus-anterior', 'spine', 'traps', 'triceps', 'upper-back',
];

export const BODY_PARTS = [
  'arms', 'legs', 'chest', 'back', 'core', 'shoulders', 'cardio',
];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band',
  'kettlebell', 'smith', 'ez-bar', 'lever', 'sled', 'other',
];

export const CATEGORIES = ['strength', 'stretching', 'cardio', 'plyometrics'];

// ---------------------------------------------------------------------------
// Tipos de tracking: determinan qué campos lleva cada serie
// ---------------------------------------------------------------------------

export const TRACKING_TYPES = [
  'weight_reps',   // press banca, sentadilla     -> weightKg + reps
  'reps',          // dominadas, flexiones        -> reps (+ addedWeightKg)
  'time',          // plancha, isométricos        -> durationSec
  'distance_time', // cinta, bici, remo           -> distanceM + durationSec
];

/** Equipamiento que implica barra: su peso cuenta en el total levantado. */
export const BAR_EQUIPMENT = ['barbell', 'ez-bar', 'smith'];

/**
 * Pesos de barra por defecto, en KILOGRAMOS.
 * El multipower (smith) varía mucho entre máquinas por el contrapeso, así que
 * el valor es orientativo y el usuario debería poder ajustarlo.
 */
export const DEFAULT_BAR_WEIGHTS_KG = {
  barbell: 20,
  'ez-bar': 7,
  smith: 15,
};

// ---------------------------------------------------------------------------
// Usuario
// ---------------------------------------------------------------------------

export const OAUTH_PROVIDERS = ['google', 'github', 'microsoft', 'discord'];

export const LOCALES = ['es', 'en'];

/** Solo afecta a la PRESENTACIÓN. En la base siempre se guarda en kg/m/s. */
export const UNIT_SYSTEMS = ['metric', 'imperial'];

export const PRIVACY_LEVELS = [
  'private', // por defecto: nadie lo ve
  'link',    // accesible con enlace directo, no sale en el buscador
  'public',  // sale en el buscador
];

/** Cómo se introduce el peso en ejercicios con barra. */
export const BAR_INPUT_MODES = [
  'plates', // el usuario escribe discos POR LADO -> la app suma la barra
  'total',  // el usuario escribe el peso total ya calculado
];

// ---------------------------------------------------------------------------
// Reglas de negocio
// ---------------------------------------------------------------------------

/**
 * Si una sesión supera este tiempo sin cerrarse, se cierra automáticamente y
 * se marca durationEstimated. Cubre el caso "se olvidó de darle a terminar y
 * se fue a casa".
 */
export const MAX_SESSION_HOURS = 4;

/** Usernames que no se pueden registrar porque chocan con rutas de la app. */
export const RESERVED_USERNAMES = [
  'admin', 'api', 'login', 'logout', 'signup', 'settings', 'profile', 'u',
  'me', 'new', 'edit', 'delete', 'search', 'explore', 'about', 'help',
  'support', 'terms', 'privacy', 'demo', 'irontrack', 'root', 'null',
  'undefined', 'static', 'assets', 'public',
];
