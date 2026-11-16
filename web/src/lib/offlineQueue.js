import Dexie from 'dexie'
import { useEffect, useState } from 'react'

// Offline queue of pending session PATCHes (Dexie).

const db = new Dexie('irontrack-offline')
db.version(1).stores({
  sessionPatches: '&sessionId, enqueuedAt',
})

export { db as offlineDb }

export async function enqueueSessionPatch(sessionId, body) {
  if (!sessionId) return
  await db.sessionPatches.put({
    sessionId,
    body,
    enqueuedAt: Date.now(),
  })
}

export async function getPendingCount() {
  return db.sessionPatches.count()
}

// Flush queued PATCHes in order.
let flushing = false

export async function flushQueue(apiFn) {
  if (flushing) return { sent: 0, failed: 0, skipped: true }
  flushing = true
  let sent = 0
  let failed = 0
  try {
    const items = await db.sessionPatches.orderBy('enqueuedAt').toArray()
    for (const item of items) {
      await db.sessionPatches.delete(item.sessionId)
      try {
        await apiFn(`/api/sessions/${item.sessionId}`, {
          method: 'PATCH',
          body: item.body,
        })
        sent += 1
      } catch (err) {
        const isNetworkError = err?.status == null
        if (isNetworkError) {
          const current = await db.sessionPatches.get(item.sessionId)
          if (!current) {
            await db.sessionPatches.put(item)
          }
          failed += 1
          break
        }
        failed += 1
      }
    }
  } finally {
    flushing = false
  }
  return { sent, failed }
}

// Flush on mount and on every online event.
export function useAutoFlush(apiFn) {
  useEffect(() => {
    const run = () => {
      flushQueue(apiFn).catch(() => {})
    }
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [apiFn])
}

export function useOfflineState() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function tick() {
      const n = await getPendingCount()
      if (!cancelled) setPending(n)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { online, pending }
}
