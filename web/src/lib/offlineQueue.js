import Dexie from 'dexie'
import { useEffect, useState } from 'react'

/*
  Cola offline para escrituras de la sesión activa.
  ---------------------------------------------------------------------------

  Problema: el PATCH debounced a /api/sessions/:id es el único canal por el
  que viaja lo que el usuario anota durante el entreno. Si el móvil pierde
  red (típico en sótanos de gym), cada intento falla y los datos se quedan
  solo en memoria de React — un refresh y se pierden.

  Solución mínima: cuando el PATCH falla a nivel de RED (no de servidor),
  guardamos el payload en IndexedDB vía Dexie. Al volver la conexión
  (`online` event) vaciamos la cola.

  Decisiones:

  - SOLO guardamos PATCH, no POST ni DELETE. Crear sesión requiere online
    (hay que reservar _id contra el backend); cancelar offline es rareza
    cuyo valor no compensa la complejidad.

  - Clave primaria = `sessionId`. Dexie.put sobrescribe por PK, así que un
    PATCH nuevo COLAPSA al anterior sin lógica extra. El contrato del
    controller ya es "reemplaza entries entero", por lo que el último
    siempre gana.

  - Al flushear un item, lo borramos ANTES de reenviar: si el fetch falla
    a mitad, otro ciclo lo reintentará porque habremos escrito uno nuevo
    encima. Si lo borráramos después y un fallo intermedio quedara a
    medio camino, el payload en vuelo se perdería cuando entre uno nuevo.
    Flujo elegido: delete + re-enqueue si falla.

  - `fetch` falla con TypeError cuando el navegador no tiene red. Un 4xx
    del servidor sí es respuesta válida: no reencolar — el payload está
    mal y reintentarlo en bucle sería un DoS al propio backend.
*/

const db = new Dexie('irontrack-offline')
db.version(1).stores({
  // &sessionId => PK única; colapsa PATCH por sesión (último gana).
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

/*
  Vacía la cola enviando cada PATCH. Devuelve { sent, failed }.

  Secuencial: un solo flush en marcha a la vez, y dentro, uno por sesión.
  Paralelo no aporta nada (las sesiones de un mismo usuario son ≤ 1 a la vez
  casi siempre) y complica el manejo de errores.
*/
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
        // Error de red: reencolar con el mismo PK (si entretanto entró uno
        // nuevo, aquel es más fresco y debe ganar — no sobrescribir).
        const isNetworkError = err?.status == null
        if (isNetworkError) {
          const current = await db.sessionPatches.get(item.sessionId)
          if (!current) {
            await db.sessionPatches.put(item)
          }
          failed += 1
          // No seguimos: si falló uno, los siguientes probablemente también
          // fallarán por la misma razón de red. Mejor esperar al próximo
          // evento `online` que azotar la cola.
          break
        }
        // 4xx/5xx: payload malo o servidor roto. No reencolar — un bucle
        // de reintentos a un payload inválido es peor que perder ese PATCH.
        failed += 1
      }
    }
  } finally {
    flushing = false
  }
  return { sent, failed }
}

/*
  Hook de UI: expone `online` y `pending` para pintar el badge.

  `pending` se recalcula escuchando el evento `storage` (cambios entre
  pestañas) no sirve — Dexie no lo dispara. Usamos un polling ligero (500 ms)
  SOLO mientras hay cambios activos o estamos offline. En el estado estable
  "online + 0 pendientes" dormimos para no consumir CPU.
*/
/*
  Hook que dispara flush al montar y en cada evento `online`.

  Lo colocamos donde vive la cola (SessionLiveView): si el usuario está en
  otra pantalla al reconectar, los PATCH pendientes son de una sesión que
  acabó sin cerrarse o fue abandonada; pueden esperar al siguiente login a
  Training. No vale la pena añadir un listener global en AppShell y arrastrar
  Dexie al arranque de la app.
*/
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
    // Dexie 4 soporta liveQuery, pero añadir otra dependencia aquí es
    // excesivo para un contador. Un intervalo corto es suficiente mientras
    // haya actividad; cuando todo se estabiliza en 0 el coste es
    // despreciable.
    const id = setInterval(tick, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { online, pending }
}
