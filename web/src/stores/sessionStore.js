// Zustand store for transient live-session UI state: rest timer and selected routine.

import { create } from 'zustand'

export const REST_DEFAULT_SEC = 120
export const REST_STEP_SEC = 30

export const useSessionStore = create((set) => ({
  restEndsAt: null,
  restTotalSec: 0,

  selectedRoutineId: null,
  setSelectedRoutineId: (id) => set({ selectedRoutineId: id }),

  startRest: (seconds) =>
    set({
      restEndsAt: Date.now() + seconds * 1000,
      restTotalSec: seconds,
    }),

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
