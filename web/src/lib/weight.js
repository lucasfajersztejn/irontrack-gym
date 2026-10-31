/*
  Conversión entre modos de entrada de peso para ejercicios con barra.

  Invariante del sistema (spec §4): el backend guarda SIEMPRE `weightKg` como
  peso TOTAL en kilogramos. La UI puede dejar al usuario introducirlo en el
  modo que prefiera (modo `'plates'`: discos por lado; modo `'total'`: peso
  total ya calculado) pero la conversión ocurre en el límite de la red, no
  en la base de datos.

  Fórmula:
    total   = perSide × 2 + barKg
    perSide = (total - barKg) / 2

  Jerarquía del peso de la barra, de mayor a menor prioridad:
    1. `entry.barWeightKg`  → el usuario lo fijó en esta rutina (olímpica).
    2. `exercise.defaultBarWeightKg` → valor baked del catálogo (Z = 7, Smith = 15).
    3. `user.settings.defaultBarWeightKg` → preferencia del usuario.
    4. 20 kg → fallback de olímpica estándar.

  El (1) solo tiene efecto para equipment 'barbell'. Z y Smith nunca lo
  consultan: su peso lo define el hardware, no el gimnasio.
*/

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
  // Olímpica sin override explícito: cae en el default del catálogo, luego
  // en la preferencia del usuario, y por último en la constante estándar.
  return exercise.defaultBarWeightKg ?? userDefaultBarKg ?? 20
}

export function totalFromPerSide(perSideKg, barKg) {
  if (perSideKg == null) return null
  return perSideKg * 2 + barKg
}

export function perSideFromTotal(totalKg, barKg) {
  if (totalKg == null) return null
  const perSide = (totalKg - barKg) / 2
  // Un total menor que la barra no tiene representación limpia por lado:
  // es un error de datos o un ejercicio sin discos. Devolvemos 0 para que
  // el input no reviente, pero el total crudo se mantiene almacenado.
  return perSide < 0 ? 0 : perSide
}

/*
  shouldShowPerSide: cuándo renderizamos el input como "por lado" en vez
  de como "total". Hoy solo si el ejercicio usa barra Y el usuario tiene
  el modo 'plates'. Las mancuernas no entran: son otro debate (¿por mano
  o por par?) y mezclarlo aquí es ruido para una PR que no lo plantea.
*/
export function shouldShowPerSide(exercise, barInputMode) {
  return Boolean(exercise?.usesBar) && barInputMode === 'plates'
}

/*
  shouldShowBarWeightInput: solo para barra olímpica. Z y Smith no se tocan
  (el hardware manda).
*/
export function shouldShowBarWeightInput(exercise) {
  return exercise?.equipment === 'barbell'
}
