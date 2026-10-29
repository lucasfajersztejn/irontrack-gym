import { create } from 'zustand'

/*
  Estado de la sesión activa (spec §2). Vive en Zustand porque cambia
  constantemente (reps, pesos, cronómetro) y Context haría re-renderizar
  las 24 series una vez por segundo. El estado real llega en Fase 1 tardía,
  cuando codeemos la pantalla "Entrenando".
*/
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
