import mongoose from 'mongoose';

/**
 * Insignia DESBLOQUEADA por un usuario. Un documento aquí significa "ganada";
 * las bloqueadas no se guardan — su progreso se calcula al vuelo en el
 * endpoint del muro comparando la métrica actual con la regla.
 *
 * ¿Por qué persistir el desbloqueo en vez de derivarlo siempre? Por `unlockedAt`:
 * el muro resalta lo "recién desbloqueado" y ordena por fecha de logro, y una
 * racha de 30 días que se rompe después no debe des-ganar la medalla. El
 * desbloqueo es un evento del dominio con fecha, no un estado recalculable.
 */
const userBadgeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    badge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Badge',
      required: true,
    },

    unlockedAt: { type: Date, required: true, default: Date.now },

    // Valor de la métrica en el momento del desbloqueo (p.ej. la racha real de
    // 34 días que disparó "streak-30"). Informativo; el muro lo puede mostrar
    // como "lo conseguiste con…". No participa en la evaluación.
    progress: { type: Number, default: null },
  },
  { timestamps: true },
);

// Un usuario gana cada insignia una sola vez. El índice único es también la
// barrera de carrera: si dos `finish` concurrentes evalúan a la vez, el segundo
// insertMany choca con E11000 y se descarta sin duplicar (ver badgeEngine).
userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });

export default mongoose.model('UserBadge', userBadgeSchema);
