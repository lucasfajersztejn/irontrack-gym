import { create } from 'zustand'

/*
  Estado de la sesión activa (spec §2). Vive en Zustand porque cambia
  constantemente (reps, pesos, cronómetro) y Context haría re-renderizar
  las 24 series una vez por segundo.

  REST_DEFAULT_SEC = 120 — mediana razonable entre "serie de hipertrofia"
  (60–90 s) y "serie pesada de fuerza" (3–5 min). Elegido en la planificación
  de Fase 1; se moverá a `user.settings.defaultRestSec` cuando Settings
  completo exista.
*/
export const REST_DEFAULT_SEC = 120

export const useSessionStore = create((set) => ({
  sessionId: null,
  startedAt: null,
  entries: [],

  setSession: (session) =>
    set({
      sessionId: session?._id ?? null,
      startedAt: session?.startedAt ?? null,
      entries: session?.entries ?? [],
    }),

  clear: () => set({ sessionId: null, startedAt: null, entries: [] }),
}))
