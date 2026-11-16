// Pick the next routine to suggest after the last session.
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
