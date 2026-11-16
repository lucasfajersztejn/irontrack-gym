/** Enums and business rules shared by all models */

// Exercise catalog taxonomy (from ExerciseGymGifsDB)

export const MUSCLES = [
  'abductors', 'abs', 'adductors', 'biceps', 'calves', 'cardio', 'delts',
  'forearms', 'glutes', 'hamstrings', 'lats', 'levator-scapulae', 'pectorals',
  'quads', 'serratus-anterior', 'spine', 'traps', 'triceps', 'upper-back',
];

export const BODY_PARTS = [
  'arms', 'legs', 'chest', 'back', 'core', 'shoulders', 'cardio',
];

/** Fine muscle to body part, for variety badges */
export const MUSCLE_TO_BODY_PART = {
  quads: 'legs',
  glutes: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  pectorals: 'chest',
  lats: 'back',
  traps: 'back',
  'upper-back': 'back',
  spine: 'back',
  'levator-scapulae': 'back',
  delts: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  abs: 'core',
  'serratus-anterior': 'core',
  cardio: 'cardio',
};

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band',
  'kettlebell', 'smith', 'ez-bar', 'lever', 'sled', 'other',
];

export const CATEGORIES = ['strength', 'stretching', 'cardio', 'plyometrics'];

// Tracking types: define each set's fields

export const TRACKING_TYPES = [
  'weight_reps',
  'reps',
  'time',
  'distance_time',
];

/** Equipment that implies a bar */
export const BAR_EQUIPMENT = ['barbell', 'ez-bar', 'smith'];

/** Default bar weights, in kg */
export const DEFAULT_BAR_WEIGHTS_KG = {
  barbell: 20,
  'ez-bar': 7,
  smith: 15,
};

// User

export const OAUTH_PROVIDERS = ['google', 'github'];

export const LOCALES = ['es', 'en'];

export const PRIVACY_LEVELS = [
  'private',
  'link',
  'public',
];

/** How weight is entered on bar exercises */
export const BAR_INPUT_MODES = [
  'plates',
  'total',
];

// Business rules

/** Open sessions are auto-closed after this many hours */
export const MAX_SESSION_HOURS = 4;

// Badges (Phase 3): declarative catalog

/** Badge families; they group the wall only */
export const BADGE_CATEGORIES = [
  'constancia',
  'volumen',
  'hitos',
  'variedad',
  'rareza',
];

/** Badge tiers; cosmetic ordering only */
export const BADGE_TIERS = ['bronce', 'plata', 'oro'];

/** Rule types the engine can evaluate */
export const BADGE_RULE_TYPES = [
  'streak',
  'sessionCount',
  'totalVolumeKg',
  'totalReps',
  'totalSets',
  'maxSessionVolumeKg',
  'maxSetsInSession',
  'maxWeightSingleKg',
  'maxGoalWeekStreak',
  'distinctActiveMonths',
  'distinctActiveDays',
  'maxDaysInWeek',
  'longestGapDays',
  'weekendSessions',
  'earlyBirdSessions',
  'nightOwlSessions',
  'accountAgeDays',
  'distinctBodyParts',
  'maxBodyPartsInWeek',
  'distinctExercises',
  'maxBodyPartsIn30DayWindow',
  'cardioSessions',
  'maxDistinctWeeksInMonth',
  'weekendPairs',
  'beatPrevWeekVolume',
  'prCount',
];

/** Declarative rule comparators */
export const BADGE_RULE_OPERATORS = ['gte', 'gt', 'lte', 'lt', 'eq'];

/** Shared demo account */
export const DEMO_ACCOUNT = { email: 'demo@irontrack.local', username: 'demo' }

/** Usernames that collide with app routes */
export const RESERVED_USERNAMES = [
  'admin', 'api', 'login', 'logout', 'signup', 'settings', 'profile', 'u',
  'me', 'new', 'edit', 'delete', 'search', 'explore', 'about', 'help',
  'support', 'terms', 'privacy', 'demo', 'irontrack', 'root', 'null',
  'undefined', 'static', 'assets', 'public',
];
