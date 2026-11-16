// Muscles worked by a routine's entries.
export function routineMuscles(entries) {
  const primary = new Set()
  const secondary = new Set()

  for (const e of entries ?? []) {
    const ex = e?.exercise
    if (!ex || typeof ex !== 'object') continue
    if (ex.muscle) primary.add(ex.muscle)
    for (const sec of ex.secondaryMuscles ?? []) secondary.add(sec)
  }

  for (const p of primary) secondary.delete(p)

  return {
    primary: Array.from(primary),
    secondary: Array.from(secondary),
  }
}
