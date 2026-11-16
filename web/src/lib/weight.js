// Bar-weight and per-side weight helpers.

const EQUIPMENT_WITH_FIXED_BAR = new Set(['ez-bar', 'smith'])

export function barWeightFor(exercise, entryBarWeightKg = null, userDefaultBarKg = 20) {
  if (!exercise?.usesBar) return 0
  if (
    exercise.equipment === 'barbell' &&
    entryBarWeightKg != null &&
    !Number.isNaN(entryBarWeightKg)
  ) {
    return entryBarWeightKg
  }
  if (EQUIPMENT_WITH_FIXED_BAR.has(exercise.equipment)) {
    return exercise.defaultBarWeightKg ?? 0
  }
  return exercise.defaultBarWeightKg ?? userDefaultBarKg ?? 20
}

export function totalFromPerSide(perSideKg, barKg) {
  if (perSideKg == null) return null
  return perSideKg * 2 + barKg
}

export function perSideFromTotal(totalKg, barKg) {
  if (totalKg == null) return null
  const perSide = (totalKg - barKg) / 2
  return perSide < 0 ? 0 : perSide
}

// Whether to show per-side weights.
export function shouldShowPerSide(exercise, barInputMode) {
  return Boolean(exercise?.usesBar) && barInputMode === 'plates'
}

// Whether to show the bar-weight input.
export function shouldShowBarWeightInput(exercise) {
  return exercise?.equipment === 'barbell'
}
