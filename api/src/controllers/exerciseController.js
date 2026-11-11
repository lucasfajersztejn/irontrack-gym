import mongoose from 'mongoose'
import { z } from 'zod'
import Exercise from '../models/exercise.model.js'
import Session from '../models/session.model.js'
import User from '../models/user.model.js'
import {
  MUSCLES,
  BODY_PARTS,
  EQUIPMENT,
  CATEGORIES,
  TRACKING_TYPES,
} from '../models/constants.js'

/**
 * Visibilidad: el usuario ve el catálogo global (createdBy: null) MÁS sus
 * ejercicios custom (createdBy === su id). Nunca los custom de otros.
 *
 * Lo expresa un $or con dos ramas sobre el mismo campo `createdBy`, que ya
 * está indexado en el modelo. Es una sola consulta, no dos finds unidos
 * en memoria.
 *
 * `mine=1` restringe a solo los custom del usuario, útil para la pantalla
 * "mis ejercicios".
 */
function visibilityFilter(userId, mineOnly) {
  if (mineOnly) return { createdBy: userId }
  return { $or: [{ createdBy: null }, { createdBy: userId }] }
}

const listQuerySchema = z.object({
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  search: z.string().trim().min(1).max(80).optional(),
  // "1" lo manda el frontend como string; z.coerce.boolean no sirve bien aquí
  // porque "0" también se castea a true. Comparo explícito.
  mine: z.enum(['0', '1']).optional(),
  favorites: z.enum(['0', '1']).optional(),
})

export const getExercises = async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }

  const { muscle, bodyPart, equipment, search, mine, favorites } = parsed.data
  const filter = visibilityFilter(req.user.id, mine === '1')
  if (muscle) filter.muscle = muscle
  if (bodyPart) filter.bodyPart = bodyPart
  if (equipment) filter.equipment = equipment
  // Usa el índice de texto bilingüe del modelo en vez de $regex sobre un subdoc.
  if (search) filter.$text = { $search: search }

  try {
    /*
      favorites=1: filtra a los que están en user.favoriteExercises. Lo
      resolvemos leyendo el array de ids una vez y pasándolo como $in — es
      más barato que un $lookup y mantiene el filter plano. Si no hay
      favoritos, devolvemos [] directo sin tocar la colección.
    */
    if (favorites === '1') {
      const user = await User.findById(req.user.id).select('favoriteExercises').lean()
      const ids = user?.favoriteExercises ?? []
      if (ids.length === 0) {
        return res.json([])
      }
      filter._id = { $in: ids }
    }

    const exercises = await Exercise.find(filter)
      .sort({ 'name.es': 1 })
      .limit(200)
    res.json(exercises)
  } catch (err) {
    next(err)
  }
}

export const getBodyParts = async (req, res, next) => {
  try {
    const bodyParts = await Exercise.distinct(
      'bodyPart',
      visibilityFilter(req.user.id, false),
    )
    res.json(bodyParts.sort())
  } catch (err) {
    next(err)
  }
}

export const getMuscles = async (req, res, next) => {
  try {
    const muscles = await Exercise.distinct(
      'muscle',
      visibilityFilter(req.user.id, false),
    )
    res.json(muscles.sort())
  } catch (err) {
    next(err)
  }
}

export const getExerciseById = async (req, res, next) => {
  // Mismo patrón que en routines: si el id no es un ObjectId válido, 404
  // directo sin tocar la base. Evita un CastError 500 que no aporta nada.
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      ...visibilityFilter(req.user.id, false),
    })
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// Custom: create / update / delete
// ---------------------------------------------------------------------------

/**
 * Genera un slug ASCII a partir de un nombre humano.
 *
 * No es un identificador público (no hay URL tipo /exercise/press-loco), es
 * un id interno + ayuda para debugging. Lo que importa es que sea estable
 * para un mismo nombre y que no rompa el índice único (slug, createdBy).
 */
function slugify(input) {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'exercise'
}

/**
 * Encuentra un slug libre dentro del ámbito del usuario.
 *
 * El usuario tiene libertad de crear 28 ejercicios con el mismo `name` visible
 * ("tengo 5 variantes de press loco"); el slug interno se desambigua con
 * sufijo numérico silencioso — el usuario nunca lo ve, pero el índice único
 * (slug, createdBy) sigue vivo y protegiéndonos de duplicados exactos a nivel
 * de datos.
 *
 * No hay condición de carrera realista: un usuario no envía dos POST a la
 * vez para crear dos ejercicios idénticos. Aun así, el índice único es la
 * última barrera: si por lo que sea dos requests chocan, Mongo rechaza una
 * con E11000 y el frontend reintentará.
 */
async function nextFreeSlug(base, userId) {
  const existing = await Exercise.find(
    { createdBy: userId, slug: new RegExp(`^${base}(-\\d+)?$`) },
    { slug: 1 },
  ).lean()
  if (existing.length === 0) return base

  const used = new Set(existing.map((e) => e.slug))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * Nombre bilingüe: debe traer al menos un idioma. Si pide los dos, los dos
 * tienen que cumplir longitud; si pide solo uno, solo se valida ese.
 */
const localizedNameSchema = z.object({
  es: z.string().trim().min(1).max(60).optional(),
  en: z.string().trim().min(1).max(60).optional(),
}).refine(
  (v) => Boolean(v.es || v.en),
  { message: 'El ejercicio necesita nombre en al menos un idioma' },
)

const instructionsSchema = z.object({
  es: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  en: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
}).optional()

const createSchema = z.object({
  name: localizedNameSchema,
  muscle: z.enum(MUSCLES),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  category: z.enum(CATEGORIES).optional(),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(5).optional(),
  instructions: instructionsSchema,
  tracking: z.enum(TRACKING_TYPES),
  visibility: z.enum(['private', 'public']).optional(),
})

/**
 * PATCH: todo opcional pero al menos un campo. No permito tocar `createdBy`,
 * `slug`, `usesBar`, `defaultBarWeightKg`, `gifUrl` ni `copiesCount` desde
 * body — son derivados o mantenidos por el servidor.
 *
 * El `name` sí se puede editar, pero el `slug` NO se regenera: es un id
 * interno estable (si el frontend lo cachea en algún sitio, cambiarlo con
 * un rename sería un bug sutil). Si el usuario quiere un slug distinto,
 * crea un ejercicio nuevo.
 */
const updateSchema = z.object({
  name: localizedNameSchema.optional(),
  muscle: z.enum(MUSCLES).optional(),
  bodyPart: z.enum(BODY_PARTS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  category: z.enum(CATEGORIES).optional(),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(5).optional(),
  instructions: instructionsSchema,
  tracking: z.enum(TRACKING_TYPES).optional(),
  visibility: z.enum(['private', 'public']).optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: 'El PATCH necesita al menos un campo' },
)

export const createExercise = async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // Base del slug: preferimos el nombre español si existe, si no el inglés.
    const base = slugify(parsed.data.name.es || parsed.data.name.en)
    const slug = await nextFreeSlug(base, req.user.id)

    const exercise = await Exercise.create({
      ...parsed.data,
      slug,
      createdBy: req.user.id,  // forzado desde sesión, nunca del body
    })
    res.status(201).json(exercise)
  } catch (err) {
    // E11000 = carrera perdida contra el índice único (slug, createdBy).
    // Devolver 409 para que el cliente reintente; es más honesto que un 500.
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Colisión de slug, reintenta' })
    }
    next(err)
  }
}

export const updateExercise = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // Doble filtro: id + propietario. Un ejercicio del catálogo global
    // (createdBy: null) nunca entrará aquí porque req.user.id != null.
    // 404 si no existe O si existe y no es del usuario — misma razón que
    // en routines, no leak de ids ajenos.
    const exercise = await Exercise.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user.id },
      { $set: parsed.data },
      {
        new: true,
        runValidators: true,
      },
    )
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    res.json(exercise)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/exercises/history?ids=<a>,<b>  -> prefill + PRs para la sesión viva
// ---------------------------------------------------------------------------

/**
 * Para cada ejercicio pedido devuelve:
 *   - lastSession: los sets de la ÚLTIMA sesión del usuario en la que apareció
 *     ese ejercicio. La UI los usa como sugerencia de prefill.
 *   - prs: tope histórico por métrica relevante al tracking. La UI los usa
 *     como baseline para detectar récords en vivo.
 *
 * Alcance acotado a propósito: solo fuerza (`weight_reps` + `reps`). Para
 * cardio los PRs mezclarían unidades y el valor no es evidente (¿"mejor
 * tiempo" en 5 km, en una hora, en un intervalo?); se dejan fuera hasta tener
 * un modelo de dominio para ello.
 *
 * Una sola aggregation por sesión: al abrir /training se piden todos los ids
 * de una. Si las rutinas crecen más allá de 40 ejercicios lo cortamos — pero
 * una rutina realista no pasa de 15 y aquí tampoco hay paginación que
 * complicar.
 */
const historyQuerySchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .refine((arr) => arr.length <= 40, {
      message: 'Máximo 40 ejercicios por llamada',
    })
    .refine((arr) => arr.every((id) => /^[a-f0-9]{24}$/i.test(id)), {
      message: 'ids contiene un ObjectId inválido',
    }),
})

export const getExercisesHistory = async (req, res, next) => {
  const parsed = historyQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const ids = parsed.data.ids.map((id) => new mongoose.Types.ObjectId(id))

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    /*
      Dos aggregations en paralelo, con contratos distintos a propósito:

        1) PRs: solo cuentan sets con `completed:true`. Una serie a medio
           escribir (peso puesto, pero sin tocar el check) no debería
           dispararnos un récord inexistente.

        2) lastSession: la última sesión del usuario en la que apareció ese
           ejercicio, con TODOS sus sets (completed o no). Prefill quiere
           saber "qué levantaste la última vez" aunque esa vez olvidaras
           marcar la casilla; el frontend mostrará los sets como sugerencia,
           no como dato propio.

      Una sola aggregation con `$top` (MongoDB 5.2+) también serviría, pero
      dos pipelines separados se leen mejor y no nos atan a una versión
      concreta del motor.
    */
    const [prRows, lastRows] = await Promise.all([
      Session.aggregate([
        { $match: { user: userId, 'entries.exercise': { $in: ids } } },
        { $unwind: '$entries' },
        { $match: { 'entries.exercise': { $in: ids } } },
        { $unwind: '$entries.sets' },
        { $match: { 'entries.sets.completed': true } },
        {
          $group: {
            _id: '$entries.exercise',
            heaviestKg: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'weight_reps'] },
                  '$entries.sets.weightKg',
                  null,
                ],
              },
            },
            best1RM: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$entries.tracking', 'weight_reps'] },
                      { $gt: ['$entries.sets.weightKg', 0] },
                      { $gt: ['$entries.sets.reps', 0] },
                    ],
                  },
                  {
                    $multiply: [
                      '$entries.sets.weightKg',
                      { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
                    ],
                  },
                  null,
                ],
              },
            },
            bestReps: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'reps'] },
                  '$entries.sets.reps',
                  null,
                ],
              },
            },
          },
        },
      ]),
      Session.aggregate([
        {
          $match: {
            user: userId,
            // `endedAt: { $ne: null }` excluye la sesión EN CURSO. Sin este
            // filtro la sesión activa es, por definición, la más reciente, y
            // el $first de abajo devolvía sus propios sets (vacíos al
            // arrancar) como "la última vez". Eso dejaba `lastSession.sets`
            // en [] y tumbaba a la vez el prefill de "+ Añadir serie" y la
            // sugerencia de progresión: la sesión en la que estás no es tu
            // historial.
            endedAt: { $ne: null },
            'entries.exercise': { $in: ids },
          },
        },
        // $sort ANTES del $unwind: así el $first en el $group respeta el
        // orden por sesión más reciente, no por el orden intrínseco del
        // array entries dentro del documento.
        { $sort: { startedAt: -1 } },
        { $unwind: '$entries' },
        {
          $match: {
            'entries.exercise': { $in: ids },
            // Y además que esa entry tenga series. Un ejercicio añadido a una
            // sesión y nunca registrado deja `sets: []`, y sin este filtro el
            // $first de abajo se quedaba con esa sesión vacía en vez de con
            // la última en que SÍ levantaste algo. Queremos "la última vez
            // que lo hiciste", no "la última sesión que lo mencionaba".
            'entries.sets.0': { $exists: true },
          },
        },
        {
          $group: {
            _id: '$entries.exercise',
            startedAt: { $first: '$startedAt' },
            sets: { $first: '$entries.sets' },
          },
        },
      ]),
    ])

    /*
      Normalización en JS: $max devuelve null cuando no hay candidato válido
      (p.ej. un ejercicio de reps solo aporta bestReps). Redondeamos best1RM
      a una decimal por ergonomía — mostrar 102.3333 kg en un toast queda feo.
    */
    const byId = {}
    for (const row of lastRows) {
      byId[row._id.toString()] = {
        lastSession: {
          startedAt: row.startedAt,
          sets: (row.sets ?? []).map((s) => ({
            order: s.order,
            weightKg: s.weightKg ?? null,
            reps: s.reps ?? null,
            addedWeightKg: s.addedWeightKg ?? null,
            durationSec: s.durationSec ?? null,
            distanceM: s.distanceM ?? null,
            rir: s.rir ?? null,
          })),
        },
        prs: { heaviestKg: null, best1RM: null, bestReps: null },
      }
    }
    for (const row of prRows) {
      const key = row._id.toString()
      if (!byId[key]) {
        // Caso raro: PRs sin lastSession implicaría sets completados en una
        // sesión que no lleva entry del ejercicio — imposible, pero no
        // bloqueamos: creamos la clave vacía para no perder los PRs.
        byId[key] = {
          lastSession: null,
          prs: { heaviestKg: null, best1RM: null, bestReps: null },
        }
      }
      byId[key].prs = {
        heaviestKg: row.heaviestKg ?? null,
        best1RM: row.best1RM != null
          ? Math.round(row.best1RM * 10) / 10
          : null,
        bestReps: row.bestReps ?? null,
      }
    }

    // Garantizamos clave presente para TODOS los ids pedidos — el frontend
    // puede iterar sin comprobar undefined.
    for (const id of parsed.data.ids) {
      if (!byId[id]) {
        byId[id] = {
          lastSession: null,
          prs: { heaviestKg: null, best1RM: null, bestReps: null },
        }
      }
    }

    res.json(byId)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/exercises/:id/progress  -> curva histórica (peso máx + 1RM) por sesión
// ---------------------------------------------------------------------------

/**
 * Para un ejercicio concreto, devuelve un punto por cada sesión del usuario
 * en la que haya una serie `completed` con `tracking === 'weight_reps'`:
 *   - heaviestKg: la mayor carga de ese día.
 *   - best1RM: el mejor Epley de ese día.
 *
 * Alcance deliberado:
 *   - Solo `weight_reps`. En cardio (`time`, `distance_time`) y asistidos
 *     (`reps` con addedWeightKg) ni "peso máx" ni "1RM" significan lo mismo;
 *     la UI oculta la curva para esos trackings. Si en el futuro queremos
 *     graficar otra cosa (mejor tiempo, mejor reps), se añade un endpoint
 *     paralelo — mezclarlos aquí haría que un punto significase cosas
 *     distintas según la fila.
 *   - Un endpoint propio en vez de ampliar /history: /history pide N
 *     ejercicios para la sesión viva (payload corto). La curva es un
 *     ejercicio con historial largo; mezclar los dos obliga al front a
 *     pedir siempre lo que no necesita.
 */
export const getExerciseProgress = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const exerciseObjectId = new mongoose.Types.ObjectId(req.params.id)

    // Comprobamos que el ejercicio existe y es visible para el usuario
    // (global o custom suyo). Sin esto, pedir una curva de un custom ajeno
    // devolvería [] silenciosamente, que es peor UX que un 404 claro.
    const exercise = await Exercise.findOne({
      _id: exerciseObjectId,
      ...visibilityFilter(req.user.id, false),
    }).select('_id').lean()
    if (!exercise) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }

    /*
      Un punto por sesión. Igual que en /history, solo cuentan sets con
      `completed: true`: un peso tecleado sin marcar no debería mover la
      curva. `$sort` al final en la pipeline garantiza que el front
      reciba los puntos en orden cronológico (asc) y no tenga que
      reordenar.
    */
    const rows = await Session.aggregate([
      { $match: { user: userId, 'entries.exercise': exerciseObjectId } },
      { $unwind: '$entries' },
      {
        $match: {
          'entries.exercise': exerciseObjectId,
          'entries.tracking': 'weight_reps',
        },
      },
      { $unwind: '$entries.sets' },
      {
        $match: {
          'entries.sets.completed': true,
          'entries.sets.weightKg': { $gt: 0 },
          'entries.sets.reps': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$_id',
          startedAt: { $first: '$startedAt' },
          heaviestKg: { $max: '$entries.sets.weightKg' },
          best1RM: {
            $max: {
              $multiply: [
                '$entries.sets.weightKg',
                { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
              ],
            },
          },
        },
      },
      { $sort: { startedAt: 1 } },
    ])

    const points = rows.map((row) => ({
      sessionId: row._id.toString(),
      date: row.startedAt,
      heaviestKg: row.heaviestKg,
      // Mismo redondeo que /history: una decimal es la resolución útil.
      best1RM: Math.round(row.best1RM * 10) / 10,
    }))

    res.json({ exerciseId: req.params.id, points })
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/exercises/recent-prs?sinceDays=30  -> récords del último mes
// ---------------------------------------------------------------------------

/**
 * Devuelve récords personales conseguidos en los últimos `sinceDays` días.
 *
 * "Récord" aquí significa superar el máximo HISTÓRICO del usuario para esa
 * métrica. No "mejor del mes": si levantaste 100 kg hace un año y 95 kg
 * esta semana, no es PR. Si hace un año fue 90 kg y esta semana 95 kg, sí.
 *
 * Alcance: solo `weight_reps` (peso más alto, 1RM estimado) y `reps`
 * (reps asistidas). Cardio queda fuera por la misma razón que /history:
 * "mejor tiempo" en una cinta depende de distancia/intensidad y no es
 * comparable entre sesiones sin un modelo que no existe todavía.
 *
 * Implementación en dos fases:
 *
 *   1) Baseline PRE-ventana: una aggregation calcula el máximo histórico
 *      por ejercicio ANTES del cutoff. Es el "qué había que batir el día
 *      que arrancó la ventana".
 *
 *   2) Walk cronológico dentro de la ventana en JS: por cada set completed
 *      se compara con la baseline y se actualiza. Si lo bate, es PR; si no,
 *      se descarta. Mantengo la baseline viva para que, si en el mismo mes
 *      hay 80 kg y luego 85 kg, solo cuente 85 como PR final de ese tipo.
 *
 * ¿Por qué el walk en JS y no 100% aggregation? Porque Mongo no tiene un
 * "running max con comparación contra baseline externa" natural sin $lookup
 * por sesión, lo cual explota a O(N²). La ventana es pequeña (30 días ~ 30
 * sesiones); procesarla en memoria es trivial y mucho más legible.
 */
const recentPrsQuerySchema = z.object({
  sinceDays: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v == null ? 30 : Number(v)))
    .refine((n) => Number.isFinite(n) && n >= 1 && n <= 365, {
      message: 'sinceDays debe estar entre 1 y 365',
    }),
})

export const getRecentPrs = async (req, res, next) => {
  const parsed = recentPrsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const sinceDays = parsed.data.sinceDays
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)

  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)

    const [preRows, windowSessions] = await Promise.all([
      // Baseline: max histórico por ejercicio antes del cutoff.
      Session.aggregate([
        { $match: { user: userId, startedAt: { $lt: cutoff } } },
        { $unwind: '$entries' },
        { $unwind: '$entries.sets' },
        { $match: { 'entries.sets.completed': true } },
        {
          $group: {
            _id: '$entries.exercise',
            heaviestKg: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'weight_reps'] },
                  '$entries.sets.weightKg',
                  null,
                ],
              },
            },
            best1RM: {
              $max: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$entries.tracking', 'weight_reps'] },
                      { $gt: ['$entries.sets.weightKg', 0] },
                      { $gt: ['$entries.sets.reps', 0] },
                    ],
                  },
                  {
                    $multiply: [
                      '$entries.sets.weightKg',
                      { $add: [1, { $divide: ['$entries.sets.reps', 30] }] },
                    ],
                  },
                  null,
                ],
              },
            },
            bestReps: {
              $max: {
                $cond: [
                  { $eq: ['$entries.tracking', 'reps'] },
                  '$entries.sets.reps',
                  null,
                ],
              },
            },
          },
        },
      ]),
      // Sesiones dentro de la ventana, en orden cronológico. Trae solo los
      // campos que el walk consume.
      Session.find({ user: userId, startedAt: { $gte: cutoff } })
        .select('startedAt entries.exercise entries.exerciseName entries.tracking entries.sets')
        .sort({ startedAt: 1 })
        .lean(),
    ])

    const baseline = new Map()
    for (const row of preRows) {
      baseline.set(row._id.toString(), {
        heaviestKg: row.heaviestKg ?? 0,
        best1RM: row.best1RM ?? 0,
        bestReps: row.bestReps ?? 0,
      })
    }

    const prs = []
    for (const session of windowSessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps' && entry.tracking !== 'reps') continue
        const exId = entry.exercise.toString()
        const base = baseline.get(exId) ?? {
          heaviestKg: 0,
          best1RM: 0,
          bestReps: 0,
        }

        for (const set of entry.sets ?? []) {
          if (!set.completed) continue

          if (entry.tracking === 'weight_reps') {
            const w = set.weightKg ?? 0
            const r = set.reps ?? 0

            if (w > base.heaviestKg) {
              prs.push({
                exerciseId: exId,
                exerciseName: entry.exerciseName ?? null,
                kind: 'heaviest',
                value: w,
                prevValue: base.heaviestKg || null,
                achievedAt: session.startedAt,
              })
              base.heaviestKg = w
            }

            if (w > 0 && r > 0) {
              const e1rm = Math.round(w * (1 + r / 30) * 10) / 10
              if (e1rm > base.best1RM) {
                prs.push({
                  exerciseId: exId,
                  exerciseName: entry.exerciseName ?? null,
                  kind: '1rm',
                  value: e1rm,
                  prevValue: base.best1RM || null,
                  achievedAt: session.startedAt,
                })
                base.best1RM = e1rm
              }
            }
          } else if (entry.tracking === 'reps') {
            const r = set.reps ?? 0
            if (r > base.bestReps) {
              prs.push({
                exerciseId: exId,
                exerciseName: entry.exerciseName ?? null,
                kind: 'reps',
                value: r,
                prevValue: base.bestReps || null,
                achievedAt: session.startedAt,
              })
              base.bestReps = r
            }
          }
        }

        baseline.set(exId, base)
      }
    }

    // Más reciente primero. La UI se queda con los N que le interesen.
    prs.sort((a, b) => new Date(b.achievedAt) - new Date(a.achievedAt))

    res.json({ sinceDays, prs })
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/exercises/stalled  -> ejercicios en los que no mejoras hace tiempo
// ---------------------------------------------------------------------------

/**
 * Detecta ejercicios ESTANCADOS: aquellos en los que el usuario no bate su
 * mejor 1RM estimado desde hace unas cuantas sesiones, pero que sigue
 * entrenando de forma activa.
 *
 * Es el negativo de /recent-prs. Aquel lista lo que SÍ mejoró; este, lo que
 * lleva tiempo plano. Juntos cuentan la historia completa: dónde progresas y
 * dónde conviene cambiar de estrategia.
 *
 * Reglas (fijadas por el usuario, ver memoria progression-rules):
 *
 *   - Métrica: mejor 1RM estimado (Epley) del día. Captura tanto subir peso
 *     como subir reps — 100×5 supera a 100×4 aunque la carga no cambie —, que
 *     es más justo que mirar solo el peso máximo.
 *   - Umbral: >= 6 sesiones del ejercicio sin batir el 1RM. Una serie plana
 *     corta es ruido normal; seis sesiones ya es una meseta.
 *   - Ventana de actividad: la última sesión del ejercicio debe ser de las
 *     últimas 8 semanas. Un ejercicio que dejaste hace meses no está
 *     "estancado", está abandonado; marcarlo sería ruido en la tarjeta.
 *
 * Implementación: un solo barrido cronológico en JS, igual que /recent-prs.
 * Mongo no expresa bien un "running max con índice del pico" sin pipelines
 * frágiles, y el historial de un usuario cabe de sobra en memoria.
 *
 * Solo `weight_reps`: ni el cardio ni los asistidos tienen un "1RM" que
 * signifique lo mismo, misma frontera que el resto de endpoints de progreso.
 */
const STALL_MIN_SESSIONS_SINCE_PR = 6
const STALL_RECENT_WEEKS = 8

export const getStalled = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const cutoff = new Date(
      Date.now() - STALL_RECENT_WEEKS * 7 * 24 * 60 * 60 * 1000,
    )

    // Todas las sesiones cerradas del usuario, en orden cronológico, con solo
    // los campos que el barrido consume. `endedAt: { $ne: null }` descarta la
    // sesión en curso: sus series a medio escribir no deben contar como "otra
    // sesión sin PR" ni como actividad reciente.
    const sessions = await Session.find({
      user: userId,
      endedAt: { $ne: null },
    })
      .select('startedAt entries.exercise entries.exerciseName entries.tracking entries.sets')
      .sort({ startedAt: 1 })
      .lean()

    /*
      Por ejercicio acumulamos una línea temporal con un punto por sesión que
      tenga trabajo VÁLIDO (al menos una serie completada con peso y reps > 0).
      Una sesión en la que el ejercicio aparece pero no se registró nada no
      cuenta como "sesión sin PR": no hubo intento que medir. Es el mismo
      criterio que /:id/progress, para que la curva que ve el usuario y esta
      detección hablen de los mismos puntos.
    */
    const byExercise = new Map()

    for (const session of sessions) {
      for (const entry of session.entries ?? []) {
        if (entry.tracking !== 'weight_reps') continue

        let sessionBest1RM = 0
        let sessionHeaviest = 0
        for (const set of entry.sets ?? []) {
          if (!set.completed) continue
          const w = set.weightKg ?? 0
          const r = set.reps ?? 0
          if (w <= 0 || r <= 0) continue
          const e1rm = w * (1 + r / 30)
          if (e1rm > sessionBest1RM) sessionBest1RM = e1rm
          if (w > sessionHeaviest) sessionHeaviest = w
        }
        if (sessionBest1RM <= 0) continue

        const key = entry.exercise.toString()
        if (!byExercise.has(key)) {
          byExercise.set(key, { name: entry.exerciseName ?? null, points: [] })
        }
        const bucket = byExercise.get(key)
        // El nombre denormalizado puede variar entre sesiones (rename de un
        // custom); nos quedamos con el más reciente, que es el último en
        // recorrerse por el orden cronológico.
        if (entry.exerciseName) bucket.name = entry.exerciseName
        bucket.points.push({
          date: session.startedAt,
          best1RM: sessionBest1RM,
          heaviest: sessionHeaviest,
        })
      }
    }

    const stalled = []
    for (const [exerciseId, { name, points }] of byExercise) {
      // Índice del pico de 1RM. `>` estricto conserva la PRIMERA vez que se
      // alcanzó el máximo: "sin PR desde entonces" se mide desde ahí, no
      // desde una repetición posterior del mismo número.
      let peakIndex = 0
      for (let i = 1; i < points.length; i += 1) {
        if (points[i].best1RM > points[peakIndex].best1RM) peakIndex = i
      }

      const sessionsSince = points.length - 1 - peakIndex
      const lastSessionAt = points[points.length - 1].date

      if (
        sessionsSince >= STALL_MIN_SESSIONS_SINCE_PR &&
        new Date(lastSessionAt) >= cutoff
      ) {
        // Peso del pico: el mayor peso real levantado hasta ese día. Es la
        // referencia honesta para proponer un deload — no el 1RM estimado,
        // que es una cifra que nadie carga en la barra.
        let peakHeaviestKg = 0
        for (let i = 0; i <= peakIndex; i += 1) {
          if (points[i].heaviest > peakHeaviestKg) peakHeaviestKg = points[i].heaviest
        }
        stalled.push({
          exerciseId,
          exerciseName: name,
          peakBest1RM: Math.round(points[peakIndex].best1RM * 10) / 10,
          peakHeaviestKg,
          peakAt: points[peakIndex].date,
          sessionsSince,
          lastSessionAt,
        })
      }
    }

    // Más estancado primero (más sesiones sin batir); empate, el más reciente
    // arriba para que la tarjeta priorice lo que el usuario entrena ahora.
    stalled.sort(
      (a, b) =>
        b.sessionsSince - a.sessionsSince ||
        new Date(b.lastSessionAt) - new Date(a.lastSessionAt),
    )

    res.json({ stalled })
  } catch (err) {
    next(err)
  }
}

export const deleteExercise = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Ejercicio no encontrado' })
  }
  try {
    const deleted = await Exercise.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user.id,  // bloquea borrar el catálogo global y ajenos
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Ejercicio no encontrado' })
    }
    // Hard delete seguro: las sesiones pasadas guardan `entries[].exerciseName`
    // y `muscle` denormalizados, así que el historial sobrevive al borrado
    // del documento original. Mismo contrato que en routines.
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
