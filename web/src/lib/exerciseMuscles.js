/*
  Deriva los grupos musculares que trabaja una lista de ejercicios.

  Se usa en dos sitios con la misma forma:
    - RoutineEditor, para los chips bajo el título de la rutina que se edita.
    - NextWorkoutCard, para el mini mapa + chips del "próximo entreno" en Home.

  Vive en lib/ (y no dentro de MuscleChips) para separar la pieza visual de
  la agregación: breakdownForSession hace lo equivalente a partir de una
  sesión ya ejecutada; esta rutina parte de la plantilla todavía en papel.

  Entradas aceptadas:
    - Entradas con `exercise` populado (backend `GET /routines/:id` con
      populate), de ahí leemos `muscle` y `secondaryMuscles`.
    - Entradas donde el ejercicio es solo un id (no populado). En ese caso
      la entrada se ignora: no inventamos músculos sin la info real.

  Secundarios: si un músculo aparece como primario en otro ejercicio, se
  elimina del set de secundarios para no pintar dos veces el mismo chip.
*/
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
