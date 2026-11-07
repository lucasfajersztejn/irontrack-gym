/*
  Elige la "próxima rutina" dentro de una rotación manual.

  Reglas:
    - Sin rutinas → null (Home pinta estado vacío).
    - Sin última sesión conocida (usuario nuevo o sin histórico útil) →
      primera rutina del orden manual: la cabecera de la rotación.
    - Con última sesión cuyo routineId pertenece al orden manual → la
      siguiente en el array, ciclando al principio al llegar al final.
    - Con última sesión cuyo routineId NO está en el orden (p.ej. sesión
      libre sin rutina, o la rutina se borró después) → primera del orden,
      porque no hay un "después" significativo del que arrancar.

  Pre-requisito: `routines` llega ya ordenado por `order` ascendente
  (listRoutines lo devuelve así desde que existe el campo). Si llegase
  desordenado, el índice que calculamos abajo rotaría mal.
*/
export function pickNextRoutine(routines, lastSession) {
  if (!routines?.length) return null

  const lastRoutineId = lastSession?.routine?._id ?? lastSession?.routine ?? null
  if (!lastRoutineId) return routines[0]

  const idx = routines.findIndex(
    (r) => String(r._id) === String(lastRoutineId),
  )
  if (idx === -1) return routines[0]

  return routines[(idx + 1) % routines.length]
}
