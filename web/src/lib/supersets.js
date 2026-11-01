/*
  Utilidades de superseries.

  Un "bloque" visual es una secuencia de entries CONSECUTIVAS con el mismo
  groupId no nulo. Un entry con groupId null es su propio bloque de 1. Nos
  obliga a trabajar sobre el array ordenado tal cual venga (sin reagrupar
  en memoria): el orden visual de la rutina lo decide `order`, y los
  ejercicios de un bloque siempre están juntos.

  La misma función se usa en el editor de rutinas y en la vista live de
  training; cada caller renderiza los bloques como prefiera (brackets,
  bordes, chips).
*/

export function groupEntries(entries) {
  const blocks = []
  let current = null
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const gid = e.groupId ?? null
    if (gid && current && current.groupId === gid) {
      current.items.push({ entry: e, index: i })
    } else {
      current = { groupId: gid, items: [{ entry: e, index: i }] }
      blocks.push(current)
    }
  }
  return blocks
}

/*
  Agrupa dos entries consecutivos. Si uno (o los dos) ya está en un
  grupo, reusa su groupId; si ninguno, genera uno nuevo. Devuelve un
  NUEVO array con los dos entries actualizados; el resto queda intacto.
  Lo llama el editor desde "Agrupar con siguiente".
*/
export function mergeWithNext(entries, index) {
  if (index < 0 || index >= entries.length - 1) return entries
  const a = entries[index]
  const b = entries[index + 1]
  const gid =
    a.groupId ||
    b.groupId ||
    (globalThis.crypto?.randomUUID?.() ??
      `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  return entries.map((e, i) => {
    if (i === index || i === index + 1) return { ...e, groupId: gid }
    return e
  })
}

/*
  Desagrupa un entry: le quita el groupId. Si tras quitarlo el grupo original
  queda con un solo miembro, ese miembro también vuelve a solo — no tiene
  sentido un "grupo de 1". Devuelve un array nuevo.
*/
export function unmergeAt(entries, index) {
  if (index < 0 || index >= entries.length) return entries
  const target = entries[index]
  const gid = target.groupId
  if (!gid) return entries
  const next = entries.map((e, i) =>
    i === index ? { ...e, groupId: null } : e,
  )
  const remaining = next.filter((e) => e.groupId === gid)
  if (remaining.length === 1) {
    return next.map((e) => (e.groupId === gid ? { ...e, groupId: null } : e))
  }
  return next
}
