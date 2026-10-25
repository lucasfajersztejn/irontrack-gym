import mongoose from 'mongoose';
import {
  MUSCLES, BODY_PARTS, EQUIPMENT, CATEGORIES, TRACKING_TYPES,
  BAR_EQUIPMENT, DEFAULT_BAR_WEIGHTS_KG,
} from './constants.js';

/**
 * Texto bilingüe. El catálogo importado trae ES y EN; los ejercicios que crea
 * el usuario traen solo uno de los dos (pedirle ambos sería fricción absurda:
 * "press loco de Juan" no tiene traducción al inglés).
 */
const localizedStringSchema = new mongoose.Schema({
  es: { type: String, trim: true },
  en: { type: String, trim: true },
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
  /**
   * Identificador legible, del estilo "barbell-curl".
   * Viene del catálogo; para los ejercicios custom se genera a partir del
   * nombre. No es unique a secas porque dos usuarios distintos pueden crear
   * cada uno su "press-loco-de-juan". Ver el índice del final.
   */
  slug: { type: String, required: true, trim: true, lowercase: true },

  name: {
    type: localizedStringSchema,
    required: true,
    validate: {
      validator: (v) => Boolean(v?.es || v?.en),
      message: 'El ejercicio necesita nombre en al menos un idioma',
    },
  },

  // -------------------------------------------------------------------------
  // Clasificación
  // -------------------------------------------------------------------------

  /**
   * Músculo principal. Es el campo por el que se busca y por el que se agrupa
   * en las estadísticas, así que es obligatorio incluso en los custom: es
   * justo lo que hace que "press loco de Juan" cuente como pecho.
   */
  muscle: { type: String, required: true, enum: MUSCLES, index: true },

  bodyPart:  { type: String, enum: BODY_PARTS },
  equipment: { type: String, enum: EQUIPMENT, default: 'other' },
  category:  { type: String, enum: CATEGORIES, default: 'strength' },

  secondaryMuscles: [{ type: String, enum: MUSCLES }],

  instructions: {
    es: [{ type: String }],
    en: [{ type: String }],
  },

  /**
   * URL del GIF en el CDN de jsDelivr.
   *
   * No guardamos el archivo: lo sirve jsDelivr gratis y globalmente, mientras
   * que alojarlo nosotros serían cientos de MB y ancho de banda propio.
   * La URL lleva el tag de versión (@v1.1.0) fijado a propósito: apuntar a
   * "main" significa que un rename del autor nos rompe 1300 imágenes.
   *
   * Los ejercicios custom no tienen GIF. Es aceptable: el usuario sabe cómo se
   * hace el ejercicio que él mismo ha inventado.
   */
  gifUrl: { type: String, trim: true, default: null },

  // -------------------------------------------------------------------------
  // Cómo se registra este ejercicio
  // -------------------------------------------------------------------------

  /**
   * Determina qué campos tiene cada serie. Sin esto, registrar 20 minutos de
   * cinta en un esquema de peso×reps es imposible.
   * El script de importación lo deduce de `category` y `equipment`.
   */
  tracking: {
    type: String,
    required: true,
    enum: TRACKING_TYPES,
    default: 'weight_reps',
  },

  /** Si lleva barra, su peso cuenta en el total levantado. */
  usesBar: { type: Boolean, default: false },

  /** Peso de la barra en kg. Null si usesBar es false. */
  defaultBarWeightKg: { type: Number, default: null, min: 0 },

  // -------------------------------------------------------------------------
  // Propiedad
  // -------------------------------------------------------------------------

  /**
   * null  -> catálogo global, visible para todo el mundo
   * ObjId -> ejercicio privado de ese usuario
   *
   * Un único modelo para los dos casos, en lugar de dos colecciones: así el
   * buscador es una sola consulta y la rutina referencia igual a unos y a
   * otros.
   *
   * Los custom NO entran al catálogo global, o en dos meses tendrías
   * "press loco de juan", "PRESS LOCO DE JUAN" y "press loco" como tres
   * ejercicios distintos.
   */
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

}, { timestamps: true });

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Deriva usesBar y el peso de barra a partir del equipamiento.
 *
 * Va en un hook y no en el script de importación para que valga también cuando
 * el usuario crea un ejercicio custom y elige "barra": la regla vive en un solo
 * sitio.
 */
exerciseSchema.pre('validate', function (next) {
  if (this.isModified('equipment') || this.isNew) {
    this.usesBar = BAR_EQUIPMENT.includes(this.equipment);
    this.defaultBarWeightKg = this.usesBar
      ? (DEFAULT_BAR_WEIGHTS_KG[this.equipment] ?? 20)
      : null;
  }
  next();
});

// ---------------------------------------------------------------------------
// Índices
// ---------------------------------------------------------------------------

/**
 * Un mismo slug puede existir una vez en el catálogo global y una vez por
 * usuario, pero no dos veces dentro del mismo ámbito. El índice compuesto sobre
 * (slug, createdBy) expresa exactamente eso.
 */
exerciseSchema.index({ slug: 1, createdBy: 1 }, { unique: true });

/** Consulta principal del buscador: "ejercicios de pecho con mancuerna". */
exerciseSchema.index({ muscle: 1, equipment: 1 });

/**
 * Búsqueda por texto en los nombres, en los dos idiomas.
 * Nota: MongoDB solo permite UN índice de texto por colección, por eso ambos
 * idiomas van en el mismo.
 */
exerciseSchema.index({ 'name.es': 'text', 'name.en': 'text' });

export default mongoose.model('Exercise', exerciseSchema);
