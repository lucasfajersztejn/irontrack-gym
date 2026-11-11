import mongoose from 'mongoose';
import {
  BADGE_CATEGORIES,
  BADGE_TIERS,
  BADGE_RULE_TYPES,
  BADGE_RULE_OPERATORS,
} from './constants.js';

/**
 * Catálogo de insignias — definido por la app, no por el usuario.
 *
 * La pieza central es `rule`: una condición DECLARATIVA, no un `if`
 * hardcodeado. El motor (lib/badgeEngine.js) lee `{ type, operator, value }`
 * y la compara contra una métrica derivada de las sesiones del usuario. El
 * objetivo de diseño, textual de la spec: "agregar la insignia número 40 debe
 * ser añadir un documento", no tocar código.
 *
 * `rule.type` puede referirse a una métrica que el motor TODAVÍA no calcula
 * (p.ej. `earlyBird`): esa insignia vive en el catálogo pero nunca se
 * desbloquea hasta que el motor aprenda a medirla. Es intencionado — el
 * catálogo puede adelantarse a la implementación sin romperla.
 */
const ruleSchema = new mongoose.Schema(
  {
    // Validamos contra la lista de tipos CONOCIDOS. Un tipo aún no soportado
    // por el motor (earlyBird) no se siembra hasta que exista su métrica; si
    // se intentara, el enum lo rechaza en vez de dejar una regla muerta.
    type: { type: String, required: true, enum: BADGE_RULE_TYPES },
    operator: { type: String, required: true, enum: BADGE_RULE_OPERATORS },
    value: { type: Number, required: true },
  },
  { _id: false },
);

const localizedSchema = new mongoose.Schema(
  {
    es: { type: String, required: true, trim: true, maxlength: 80 },
    en: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { _id: false },
);

const badgeSchema = new mongoose.Schema(
  {
    // Identificador estable y legible ("streak-30"). Es la clave del seed
    // idempotente: upsert por slug no duplica al re-sembrar.
    slug: { type: String, required: true, trim: true, maxlength: 60 },

    name: { type: localizedSchema, required: true },
    description: { type: localizedSchema, required: true },

    category: { type: String, required: true, enum: BADGE_CATEGORIES },
    tier: { type: String, required: true, enum: BADGE_TIERS },

    // SVG en el CDN, mismo criterio que los GIF de ejercicios: no se alojan
    // aquí. Opcional en Fase 3 inicial — el muro puede renderizar un
    // hexágono genérico por categoría mientras no haya arte definitivo.
    iconUrl: { type: String, trim: true, default: null },

    rule: { type: ruleSchema, required: true },
  },
  { timestamps: true },
);

// Consulta real: el seed hace upsert por slug, y el motor nunca pide una
// insignia por slug suelto, pero el índice único es la barrera de datos contra
// un catálogo con dos "streak-30".
badgeSchema.index({ slug: 1 }, { unique: true });

export default mongoose.model('Badge', badgeSchema);
