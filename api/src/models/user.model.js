import mongoose from 'mongoose';
import {
  OAUTH_PROVIDERS, LOCALES, UNIT_SYSTEMS, PRIVACY_LEVELS,
  BAR_INPUT_MODES, RESERVED_USERNAMES,
} from './constants.js';

/**
 * Preferencias del usuario.
 *
 * Van en un subdocumento con _id: false porque no son una entidad propia: no
 * tiene sentido buscar unas preferencias sueltas ni referenciarlas desde otro
 * sitio. Son parte del usuario. Mongoose por defecto le pone un _id a cada
 * subdocumento, y aquí solo sería ruido.
 */
const settingsSchema = new mongoose.Schema({
  locale:  { type: String, enum: LOCALES,      default: 'es' },

  // OJO: esto solo cambia cómo se MUESTRAN los datos. En la base todo se
  // guarda siempre en kg, metros y segundos. Ver session.model.js.
  units:   { type: String, enum: UNIT_SYSTEMS, default: 'metric' },

  barInputMode: { type: String, enum: BAR_INPUT_MODES, default: 'plates' },

  // Peso de la barra olímpica que usa habitualmente. Algunos gimnasios tienen
  // barras de 15 kg como estándar.
  defaultBarWeightKg: { type: Number, default: 20, min: 0, max: 50 },

  restTimerSec: { type: Number, default: 90, min: 0, max: 600 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  // -------------------------------------------------------------------------
  // Identidad
  // -------------------------------------------------------------------------

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,  // normaliza antes de guardar: Lucas@X.com -> lucas@x.com
    trim: true,
  },

  /**
   * Lo aporta el proveedor de OAuth. Solo vinculamos cuentas entre proveedores
   * cuando el email viene verificado; si no, cualquiera podría crear una cuenta
   * en un proveedor con TU email y quedarse con tu cuenta de IronTrack.
   */
  emailVerified: { type: Boolean, default: false },

  /**
   * Proveedores con los que esta persona ha entrado alguna vez.
   * Al entrar con uno nuevo cuyo email verificado ya existe, se añade aquí en
   * lugar de crear un usuario duplicado.
   */
  providers: [{ type: String, enum: OAUTH_PROVIDERS }],

  /**
   * Username público: la URL del perfil es /u/<username>.
   *
   * Empieza en null porque OAuth no nos da uno: Google devuelve nombre y email,
   * no un identificador corto. El usuario lo elige en el onboarding, justo
   * después del primer login.
   *
   * NO ponemos unique: true aquí. Un índice unique normal trata null como un
   * valor más, así que el segundo usuario sin username fallaría al guardar.
   * Se resuelve abajo con un índice parcial.
   */
  username: {
    type: String,
    default: null,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 20,
    // Solo letras, números, guion y guion bajo: evita usernames con espacios,
    // emojis o barras que romperían la URL del perfil.
    match: /^[a-z0-9_-]+$/,
    validate: {
      validator: (v) => v === null || !RESERVED_USERNAMES.includes(v),
      message: 'Ese nombre de usuario no está disponible',
    },
  },

  displayName: { type: String, trim: true, maxlength: 50 },
  avatarUrl:   { type: String, trim: true },

  // -------------------------------------------------------------------------
  // Configuración
  // -------------------------------------------------------------------------

  settings: { type: settingsSchema, default: () => ({}) },

  /**
   * Por defecto PRIVADO. El usuario opta por exponerse, no al revés.
   * (Además de ser lo correcto, es lo que pide el RGPD.)
   */
  privacy: { type: String, enum: PRIVACY_LEVELS, default: 'private' },

}, {
  // Añade createdAt y updatedAt automáticamente y los mantiene al día.
  timestamps: true,
});

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

/**
 * Índice parcial: aplica la unicidad SOLO a los documentos cuyo username es un
 * string. Los que lo tienen en null quedan fuera del índice, así que pueden
 * coexistir muchos usuarios a medio registrar sin chocar entre sí.
 */
userSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);

/**
 * Para el buscador de usuarios (fase 3). Solo indexa los públicos, que son los
 * únicos que pueden aparecer en resultados: el índice es más pequeño y además
 * hace imposible por construcción que se cuele un perfil privado.
 */
userSchema.index(
  { username: 1, displayName: 1 },
  { partialFilterExpression: { privacy: 'public' } },
);

// ---------------------------------------------------------------------------
// Serializador público
// ---------------------------------------------------------------------------

/**
 * Devuelve SOLO lo que puede ver un tercero.
 *
 * La regla importante: filtrar en el servidor, nunca en el frontend. Si mandas
 * el documento entero y lo escondes en React, cualquiera lo ve abriendo la
 * pestaña de red del navegador. Aquí el email y las settings no salen nunca
 * del backend.
 */
userSchema.methods.toPublicJSON = function () {
  return {
    username:    this.username,
    displayName: this.displayName,
    avatarUrl:   this.avatarUrl,
    createdAt:   this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
