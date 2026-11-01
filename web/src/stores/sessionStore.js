import { create } from 'zustand'

/*
  Cronómetro de descanso de la sesión activa (spec §2).

  Lo arranca SIEMPRE el usuario desde la barra fija de RestTimerBar; nunca
  se dispara al marcar una serie. Apuntar el dato y empezar a descansar no
  son el mismo momento, y un cronómetro que salta solo obliga a pararlo.

  Vive en Zustand y no en el estado de SessionLiveView por la razón que
  justifica el store en CLAUDE.md: es el único dato que cambia cada segundo.
  Teniéndolo aquí, solo RestTimerBar se suscribe y re-renderiza por tick;
  las 24 filas de series no se enteran.

  INVARIANTE (spec §9): guardamos un TIMESTAMP de fin (`endsAt`), no un
  contador que decrementa. Un setInterval que resta 1 se congela cuando el
  móvil se bloquea o el navegador descarta el timer en background, y al
  volver marcaría un descanso más corto del real. Con `endsAt` el tick solo
  provoca el repintado: lo que queda siempre se deriva de Date.now().

  REST_DEFAULT_SEC = 120 — mediana razonable entre "serie de hipertrofia"
  (60–90 s) y "serie pesada de fuerza" (3–5 min). El descanso arranca
  SIEMPRE en este valor; ajustarlo es trabajo de los botones −30/+30 de la
  barra, no de una preferencia que haya que ir a buscar a Settings.

  REST_STEP_SEC es el salto de esos botones.
*/
export const REST_DEFAULT_SEC = 120
export const REST_STEP_SEC = 30

export const useSessionStore = create((set) => ({
  // Epoch ms en el que termina el descanso, o null si no hay descanso activo.
  restEndsAt: null,
  // Duración pedida, necesaria para dibujar cuánto queda en proporción.
  restTotalSec: 0,

  startRest: (seconds) =>
    set({
      restEndsAt: Date.now() + seconds * 1000,
      restTotalSec: seconds,
    }),

  /*
    Botones −30 / +30 de la barra. `seconds` puede ser negativo.

    Ajusta sobre el fin previsto, no sobre "ahora": si quedan 10 s y pides
    30 más, quieres 40 s de descanso, no 30. restTotalSec se mueve con él
    para que la pista de progreso siga representando la proporción real.

    Clamp a `Date.now()`: restar nunca deja el fin en el pasado, porque un
    `endsAt` pasado haría que el restante saliera negativo en el primer
    cálculo antes de que la UI lo normalice.
  */
  adjustRest: (seconds) =>
    set((s) => {
      if (!s.restEndsAt) return s
      return {
        restEndsAt: Math.max(Date.now(), s.restEndsAt + seconds * 1000),
        restTotalSec: Math.max(1, s.restTotalSec + seconds),
      }
    }),

  stopRest: () => set({ restEndsAt: null, restTotalSec: 0 }),
}))
