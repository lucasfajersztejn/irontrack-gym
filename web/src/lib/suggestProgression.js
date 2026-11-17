// Progression suggestions: first set, next set, deload.

const STEP_KG = 2.5

const BIG_STEP_KG = 5

const BIG_STEP_RIR = 3

function snapToStep(kg) {
  if (kg == null) return null
  return Math.max(0, Math.round(kg / STEP_KG) * STEP_KG)
}

// Suggest the first set of the day.
export function suggestFirstSetOfDay({ firstSetLastTime, plannedSet } = {}) {
  if (firstSetLastTime?.weightKg != null) {
    return {
      weightKg: snapToStep(firstSetLastTime.weightKg + STEP_KG),
      reps: firstSetLastTime.reps ?? null,
    }
  }
  if (plannedSet?.weightKg != null) {
    return {
      weightKg: snapToStep(plannedSet.weightKg),
      reps: plannedSet.reps ?? null,
    }
  }
  return null
}

// Suggest the next set in the session from RIR.
export function suggestNextSetInSession({ lastSet } = {}) {
  if (lastSet?.weightKg == null) return null
  const { weightKg, reps = null, rir } = lastSet

  if (rir == null || rir === 0) {
    return { weightKg, reps }
  }

  const isBigStep = rir >= BIG_STEP_RIR
  const nextReps =
    reps == null
      ? null
      : Math.max(1, isBigStep ? Math.round(reps / 2) : reps - 2)

  return {
    weightKg: snapToStep(weightKg + (isBigStep ? BIG_STEP_KG : STEP_KG)),
    reps: nextReps,
  }
}

const DELOAD_FRACTION = 0.1

// Suggest a deload starting weight from the peak.
export function suggestDeload({ peakKg } = {}) {
  if (peakKg == null || peakKg <= 0) return null
  const target = snapToStep(peakKg * (1 - DELOAD_FRACTION))
  if (target >= peakKg) return Math.max(0, snapToStep(peakKg - STEP_KG))
  return target
}
