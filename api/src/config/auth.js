import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import Session from '../models/session.model.js'
import Routine from '../models/routine.model.js'
import Exercise from '../models/exercise.model.js'

/**
 * Better Auth necesita un `MongoClient` nativo, no la conexión de Mongoose
 * (lo deja claro su propia doc: "direct database connections are unsupported").
 * Son dos conexiones a la misma Atlas; en portfolio es asumible. Si en el
 * futuro quieres compartir una sola conexión, el truco es extraer el topology
 * de Mongoose con `mongoose.connection.getClient()` tras `connectDB()`.
 */
const mongoClient = new MongoClient(process.env.MONGO_URI)
await mongoClient.connect()
const db = mongoClient.db()

export const auth = betterAuth({
  database: mongodbAdapter(db),

  // Firma de sesiones. Si cambias el secret, caducan todas las sesiones vivas.
  secret: process.env.BETTER_AUTH_SECRET,

  // URL base donde Better Auth cree que está desplegado. Importante para los
  // redirects de OAuth: tiene que coincidir con lo que configuraste en Google.
  baseURL: process.env.BETTER_AUTH_URL,

  /**
   * Spec §5: solo OAuth, nada de email+password. Lo deshabilitamos
   * explícitamente para que un cambio futuro en Better Auth no lo active
   * por defecto.
   */
  emailAndPassword: { enabled: false },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    // github, microsoft, discord — pendiente de credenciales (spec §5).
  },

  user: {
    /**
     * Clave de alineación con el modelo Mongoose: Better Auth y nuestro
     * `User.model` escriben a la MISMA colección (`users`). Así el documento
     * que Better Auth crea en el OAuth callback es el mismo que leemos luego
     * con `User.findById()` para componer `/api/me`.
     */
    modelName: 'users',

    /**
     * Borrado de cuenta (RGPD: derecho de supresión). Better Auth lo trae
     * desactivado; lo activamos y le colgamos la limpieza de NUESTRAS
     * colecciones.
     *
     * Reparto de responsabilidades:
     *   - Better Auth borra lo suyo (`users`, `accounts`, `sessions`) en su
     *     `internalAdapter.deleteUser` y limpia la cookie de sesión.
     *   - `beforeDelete` borra lo de IronTrack. Es el ÚNICO sitio donde vive
     *     esa lista: al añadir una colección nueva por usuario hay que
     *     acordarse de este hook.
     *
     * No quedan huérfanos que perseguir después: los ejercicios custom solo
     * son visibles para su dueño y `Session.entries.exerciseName` es un
     * snapshot histórico, no una referencia viva al catálogo.
     *
     * Sin transacción, a propósito. Atlas las soporta, pero los borrados de
     * Better Auth caerían fuera de ella de todas formas, así que la
     * atomicidad sería falsa. La garantía real es que cada `deleteMany` es
     * idempotente: si uno falla, el hook lanza, Better Auth aborta el borrado
     * del usuario y se puede reintentar sin que lo ya borrado estorbe.
     */
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await Promise.all([
          Session.deleteMany({ user: user.id }),
          Routine.deleteMany({ user: user.id }),
          Exercise.deleteMany({ createdBy: user.id }),
        ])
      },
    },
  },

  account: {
    modelName: 'accounts',

    accountLinking: {
      /**
       * Si alguien entra con Google y después con GitHub usando el mismo email
       * verificado, Better Auth lo trata como la misma cuenta y añade el nuevo
       * proveedor a `accounts` en lugar de crear un usuario duplicado.
       *
       * `trustedProviders` controla qué proveedores podemos CONFIAR cuando
       * dicen "este email está verificado". Google lo verifica, siempre:
       * incluimos Google. GitHub lo verifica si el usuario marcó el email como
       * primario; si lo añadimos aquí, lo mismo. Microsoft y Discord vendrán
       * después.
       */
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 30, // 30 días

    /**
     * `freshAge: 0` desactiva el control de "sesión fresca".
     *
     * Por defecto Better Auth exige que la sesión se haya creado hace menos
     * de un día para las operaciones sensibles (borrar cuenta es una), y si
     * no, pide contraseña o un email de verificación. Aquí no hay ninguna de
     * las dos: solo OAuth, sin `passwordHash`, y sin dominio propio
     * verificado para mandar correo (spec §5).
     *
     * Con sesiones de 30 días, dejarlo activado significa que casi cualquiera
     * que quiera borrar su cuenta se choca con un 400 que no podemos
     * resolver. Se apaga, y el freno pasa a la UI: el borrado exige escribir
     * el propio username. Hoy no hay ninguna otra operación que dependa de la
     * frescura de la sesión, así que no se pierde nada más por el camino.
     */
    freshAge: 0,
  },

  /**
   * Lista de orígenes que pueden iniciar flujos de auth (navegadores que
   * pueden embeber los redirects de OAuth). Comparten valor con CORS_ORIGINS
   * porque es el mismo dominio del frontend.
   */
  trustedOrigins: (process.env.CORS_ORIGINS || '')
    .split(',').map((o) => o.trim()).filter(Boolean),
})
