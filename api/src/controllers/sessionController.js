import mongoose from 'mongoose'
import { z } from 'zod'
import Session from '../models/session.model.js'
import Routine from '../models/routine.model.js'
import { MUSCLES, TRACKING_TYPES, MAX_SESSION_HOURS } from '../models/constants.js'

/**
 * Schemas Zod
 * ---------------------------------------------------------------------------
 *
 * El pre('validate') del modelo ya hace la validación cruzada (endedAt >=
 * startedAt, campos requeridos por tracking). Zod solo valida FORMA: tipos,
 * rangos razonables, enums. Dos capas con responsabilidades distintas:
 *
 *   Zod   -> "¿esto parece un payload de sesión?"
 *   Model -> "¿este payload cumple las reglas de negocio?"
 *
 * Duplicar validación lógica en Zod sería sincronizar reglas en dos sitios
 * cada vez que cambie el modelo. Mejor delegar la parte dura al schema.
 */
const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId inválido')

const setSchema = z.object({
  order: z.number().int().min(0),
  weightKg: z.number().min(0).optional(),
  reps: z.number().int().min(0).optional(),
  addedWeightKg: z.number().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
  distanceM: z.number().min(0).optional(),
  rpe: z.number().min(1).max(10).optional(),
  completed: z.boolean().optional(),
  restSec: z.number().int().min(0).optional(),
})

const entrySchema = z.object({
  exercise: objectIdSchema,
  exerciseName: z.string().trim().min(1).max(100),
  muscle: z.enum(MUSCLES),
  tracking: z.enum(TRACKING_TYPES),
  order: z.number().int().min(0),
  // Superset: ver routine.model.js — cliente lo genera, servidor solo valida
  // forma. nullable para "ejercicio solo".
  groupId: z.string().trim().max(64).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
  sets: z.array(setSchema).default([]),
})

const createSchema = z.object({
  // null explícito = sesión libre. Omitir también = sesión libre.
  routine: objectIdSchema.nullable().optional(),
  startedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional(),
})

const updateSchema = z.object({
  entries: z.array(entrySchema).optional(),
  notes: z.string().trim().max(1000).optional(),
  startedAt: z.coerce.date().optional(),
  // endedAt admite null por si el usuario quiere "reabrir" una sesión cerrada.
  endedAt: z.coerce.date().nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, {
  message: 'El PATCH necesita al menos un campo',
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Techo duro: evita que un cliente pida 10 000 sesiones de una. Spec §3.6.
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  routine: objectIdSchema.optional(),
})

// ---------------------------------------------------------------------------
// GET /api/sessions  -> historial paginado SIN el array entries
// ---------------------------------------------------------------------------

/**
 * Mismo patrón que listRoutines: aggregation en Mongo, nunca traigo el array
 * pesado por la red. `entryCount` y `setCount` los calcula el servidor con
 * $size — útiles para pintar la tarjeta de cada sesión sin pedir el detalle.
 *
 * El filtro por rango de fechas usa `startedAt` porque es el campo indexado
 * (user, startedAt desc). `endedAt` podría ser null (sesión activa) y filtrar
 * por él se saltaría el índice.
 */
export async function listSessions(req, res, next) {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Parámetros inválidos',
      issues: parsed.error.issues,
    })
  }
  const { page, limit, from, to, routine } = parsed.data
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id)
    const match = { user: userId }
    if (from || to) {
      match.startedAt = {}
      if (from) match.startedAt.$gte = from
      if (to) match.startedAt.$lte = to
    }
    if (routine) match.routine = new mongoose.Types.ObjectId(routine)

    const result = await Session.aggregate([
      { $match: match },
      { $sort: { startedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          routine: 1,
          routineName: 1,
          startedAt: 1,
          endedAt: 1,
          durationEstimated: 1,
          notes: 1,
          createdAt: 1,
          updatedAt: 1,
          entryCount: { $size: { $ifNull: ['$entries', []] } },
          setCount: {
            $sum: {
              $map: {
                input: { $ifNull: ['$entries', []] },
                as: 'e',
                in: { $size: { $ifNull: ['$$e.sets', []] } },
              },
            },
          },
          // Duración calculada en el servidor; el virtual del modelo no entra
          // en una aggregation (no hay documento Mongoose aquí).
          durationSec: {
            $cond: [
              { $ifNull: ['$endedAt', false] },
              {
                $round: [
                  { $divide: [{ $subtract: ['$endedAt', '$startedAt'] }, 1000] },
                ],
              },
              null,
            ],
          },
        },
      },
    ])
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/sessions/active  -> la sesión abierta del usuario, o null
// ---------------------------------------------------------------------------

/**
 * Endpoint separado del listado por una razón concreta: el frontend lo llama
 * en CADA arranque de la PWA para saber "¿tengo algo abierto a lo que volver?".
 * Si lo mezcláramos con el listado, cada boot tiraría una paginación completa
 * para extraer una sola fila. Separado, es un findOne barato.
 *
 * También evita que un segundo dispositivo cree una sesión paralela: antes de
 * POST, el cliente pregunta aquí.
 */
export async function getActiveSession(req, res, next) {
  try {
    // populate solo en /active: la vista "live" necesita gifUrl, instructions,
    // usesBar y defaultBarWeightKg del catálogo para pintar el GIF del help,
    // el hint de peso total con barra, y los chips. La denormalización del
    // modelo (exerciseName, muscle, tracking) basta para historial, pero el
    // training en vivo lee más. No tocamos listSessions/getSession porque
    // esas rutas se consumen desde cards densas donde el payload extra sería
    // ruido.
    const session = await Session.findOne({
      user: req.user.id,
      endedAt: null,
    }).populate('entries.exercise')
    // 200 con null (no 404): "no hay activa" es una respuesta normal, no un
    // error. El frontend tiene que distinguir "ruta rota" de "nada abierto".
    res.json(session || null)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// GET /api/sessions/:id  -> detalle
// ---------------------------------------------------------------------------

export async function getSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    // populate igual que en /active: /stats/week y useHomeData leen entries
    // para desglosar por grupo muscular (incluidos los secundarios) y
    // calcular 1RM; sin populate perderíamos `secondaryMuscles` que solo
    // vive en el catálogo. La denormalización del modelo (exerciseName,
    // muscle, tracking) sigue siendo el ancla para historial — populate
    // añade capacidad analítica sin romperla.
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    }).populate('entries.exercise')
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }
    // toJSON con virtuals ya está activado en el modelo -> durationSec llega.
    res.json(session)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/sessions  -> arranca una sesión
// ---------------------------------------------------------------------------

/**
 * Dos modos:
 *
 *   1. `routine` presente: carga la rutina del usuario y copia sus ejercicios
 *      denormalizando `exerciseName`, `muscle`, `tracking`. Los `sets`
 *      arrancan vacíos: el usuario los va añadiendo mientras entrena.
 *
 *   2. `routine` null o ausente: sesión libre, sin plantilla.
 *
 * En ambos casos: antes de crear, verifica que no haya ya una sesión activa.
 * Dos activas simultáneas no tienen sentido en el dominio (una persona,
 * un gimnasio, un entrenamiento), y /active devolvería la primera y
 * "esconder" la segunda.
 */
export async function createSession(req, res, next) {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    // Guardia de "una activa a la vez". Hay una ventana de carrera teórica
    // entre este findOne y el create siguiente, pero: (a) el frontend ya
    // llama a /active en cada boot, (b) un usuario humano no envía dos POST
    // en 20 ms. Si pasa, el usuario acaba con dos sesiones; el daño es
    // acotado y recuperable con un DELETE. Para blindarlo del todo haría
    // falta un índice único parcial sobre {user, endedAt:null}, que Mongo
    // admite y podría añadirse si en algún momento vemos duplicados reales.
    const active = await Session.findOne({
      user: req.user.id,
      endedAt: null,
    }).select('_id')
    if (active) {
      return res.status(409).json({
        message: 'Ya tienes una sesión activa',
        activeId: active._id,
      })
    }

    const doc = {
      user: req.user.id,
      startedAt: parsed.data.startedAt || new Date(),
      notes: parsed.data.notes,
      entries: [],
      routine: null,
      routineName: null,
    }

    if (parsed.data.routine) {
      // Doble filtro: id + user. Nadie arranca una sesión desde la rutina de
      // otro usuario; devolvemos 404 (no 403) para no filtrar la existencia.
      const routine = await Routine.findOne({
        _id: parsed.data.routine,
        user: req.user.id,
      }).populate('exercises.exercise')
      if (!routine) {
        return res.status(404).json({ message: 'Rutina no encontrada' })
      }

      doc.routine = routine._id
      doc.routineName = routine.name
      doc.entries = routine.exercises.map((re) => ({
        exercise: re.exercise._id,
        // Denormalización deliberada (ver comentario del modelo): el nombre
        // y el músculo del ejercicio quedan congelados aquí para que el
        // historial sobreviva a cambios o borrados en el catálogo.
        exerciseName: re.exercise.name?.es || re.exercise.name?.en || 'Ejercicio',
        muscle: re.exercise.muscle,
        tracking: re.exercise.tracking,
        order: re.order,
        // Copia del superset: la sesión arranca con los bloques tal cual
        // los dejó la rutina; el usuario puede modificarlos durante el
        // entreno sin tocar la plantilla.
        groupId: re.groupId ?? null,
        notes: re.notes,
        sets: [], // vacíos: se van rellenando durante el entrenamiento.
      }))
    }

    const session = await Session.create(doc)
    res.status(201).json(session)
  } catch (err) {
    next(err)
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:id  -> edita campos
// ---------------------------------------------------------------------------

/**
 * Por qué fetch + assign + save en vez de findOneAndUpdate con runValidators:
 *
 * El modelo tiene un pre('validate') que valida ENDEDAT >= STARTEDAT y los
 * campos requeridos por tracking en cada set. Esos hooks los dispara save(),
 * NO findOneAndUpdate (ni siquiera con runValidators, que solo corre los
 * validadores de path). Un PATCH con un set incompleto se colaría. La única
 * forma segura es cargar el documento, asignar, y llamar a save().
 *
 * Trade-off aceptado: dos round-trips a Mongo en vez de uno. La frecuencia
 * (un patch cada varios segundos durante un entreno) hace el coste
 * irrelevante.
 */
export async function updateSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Payload inválido',
      issues: parsed.error.issues,
    })
  }
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }

    const data = parsed.data
    if (data.entries !== undefined) session.entries = data.entries
    if (data.notes !== undefined) session.notes = data.notes
    if (data.startedAt !== undefined) session.startedAt = data.startedAt
    if (Object.prototype.hasOwnProperty.call(data, 'endedAt')) {
      session.endedAt = data.endedAt
      // Si el usuario toca endedAt a mano, su valor manda y el "estimado"
      // del cierre automático deja de ser cierto. El modelo deja ESTA
      // decisión al servicio a propósito (ver comentario en session.model.js).
      session.durationEstimated = false
    }

    await session.save()
    res.json(session)
  } catch (err) {
    // Errores de validación del modelo llegan aquí con name === 'ValidationError'
    // o lanzados en el pre('validate'). Los convertimos en 400 limpios en vez
    // de dejarlos escalar a 500.
    if (err?.name === 'ValidationError' || err?.name === 'Error') {
      return res.status(400).json({ message: err.message })
    }
    next(err)
  }
}

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/finish  -> cierre
// ---------------------------------------------------------------------------

/**
 * Endpoint propio en vez de un PATCH con endedAt: finish es una TRANSICIÓN DE
 * ESTADO (acaba el entreno, incrementa timesUsed en la rutina, en Fase 3
 * dispara el motor de insignias). Darle su propia ruta deja clara la
 * diferencia entre "actualizo un campo" y "aplico un evento del dominio".
 *
 * Idempotente a propósito: si la sesión ya está cerrada, devuelve 200 con
 * el estado actual y NO reincrementa el contador. Así el frontend puede
 * reintentar sin miedo (red flaky, doble tap en el botón) y sin cuadruplicar
 * el `timesUsed` de la rutina.
 */
export async function finishSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!session) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }

    // Idempotencia: ya cerrada -> no toca nada, devuelve 200 con el estado.
    if (session.endedAt) {
      return res.json(session)
    }

    session.endedAt = new Date()
    await session.save()

    // Solo si venía de una rutina: incrementa su contador y mueve lastUsedAt.
    // Sesión libre no cuenta para ninguna rutina.
    //
    // $inc + $set en la misma operación: una sola escritura, sin leer el
    // documento. Si la rutina se borró entretanto, el update no hace nada
    // (updateOne devuelve matchedCount: 0) y la sesión sigue cerrada: no es
    // un error, es que el usuario borró su rutina mientras entrenaba.
    if (session.routine) {
      await Routine.updateOne(
        { _id: session.routine, user: req.user.id },
        {
          $inc: { timesUsed: 1 },
          $set: { lastUsedAt: session.endedAt },
        },
      )
    }

    res.json(session)
  } catch (err) {
    if (err?.name === 'ValidationError' || err?.name === 'Error') {
      return res.status(400).json({ message: err.message })
    }
    next(err)
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/sessions/:id  -> hard delete
// ---------------------------------------------------------------------------

/**
 * Hard delete, mismo criterio que en rutinas y custom exercises. No hay
 * nada "aguas abajo" que se rompa: las estadísticas se derivan de las
 * sesiones VIVAS; borrar una la hace desaparecer del heatmap y del volumen,
 * que es exactamente lo que el usuario quiere al pulsar borrar.
 *
 * No tocamos routine.timesUsed al borrar: ese contador refleja "veces que se
 * CARGÓ y COMPLETÓ la rutina en su día", no un estado presente. Decrementar
 * al borrar lo convertiría en una cuenta volátil y perderíamos la historia.
 */
// ---------------------------------------------------------------------------
// POST /api/sessions/sweep  -> cierra sesiones huérfanas (admin)
// ---------------------------------------------------------------------------

/**
 * Cierra en lote las sesiones que llevan más de MAX_SESSION_HOURS abiertas.
 * Cubre el caso "el usuario se olvidó de darle a terminar y se fue a casa".
 *
 * Por qué un endpoint y no un `setInterval` en Node:
 *   - Fly.io reinicia contenedores y un timer en memoria se pierde.
 *   - Un endpoint es reproducible desde fuera (curl + token), testeable
 *     a mano y disparable por cualquier scheduler (Fly cron, GH Actions,
 *     cron-job.org). La máquina que lo llama es intercambiable.
 *
 * Por qué `endedAt = startedAt + MAX_SESSION_HOURS` y no `endedAt = now`:
 *   - El cron puede correr a las 2 h o a las 2 h y 7 min. Usar `now`
 *     metería ese jitter en la duración "real" de las sesiones cerradas.
 *   - Fijar el final al límite del dominio (4 h) es consistente con lo que
 *     el flag `durationEstimated: true` ya promete al usuario: "no sabemos
 *     cuándo acabaste, asumimos el máximo".
 *
 * updateMany atómico en Mongo: no cargamos N documentos a Node para iterar;
 * una sola operación los cierra todos y nos dice cuántos. Si no hay ninguno,
 * `modifiedCount` es 0 y el 200 vale igual (idempotente).
 */
export async function sweepSessions(req, res, next) {
  try {
    const now = new Date()
    const cutoff = new Date(now.getTime() - MAX_SESSION_HOURS * 3600 * 1000)

    const result = await Session.updateMany(
      { endedAt: null, startedAt: { $lt: cutoff } },
      [
        // Pipeline update: `endedAt` depende de `startedAt` del propio doc,
        // así que necesito el update aggregation (array), no el clásico.
        {
          $set: {
            endedAt: {
              $add: ['$startedAt', MAX_SESSION_HOURS * 3600 * 1000],
            },
            durationEstimated: true,
          },
        },
      ],
    )

    res.json({
      closed: result.modifiedCount,
      cutoff,
    })
  } catch (err) {
    next(err)
  }
}

export async function deleteSession(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sesión no encontrada' })
  }
  try {
    const deleted = await Session.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    })
    if (!deleted) {
      return res.status(404).json({ message: 'Sesión no encontrada' })
    }
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
