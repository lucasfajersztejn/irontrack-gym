// Superset grouping helpers.

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

// Merge an entry with the next one into a superset.
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

// Remove an entry from its superset.
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
