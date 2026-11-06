import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { estimate1RM } from './stats.js'

/*
  Carga, al arrancar la sesión live, el historial relevante de cada ejercicio
  (última sesión + PRs) desde GET /api/exercises/history. Expone dos cosas:

  - `history[exerciseId]`: { lastSession, prs } tal como viene del backend.
  - `detectPR(exerciseId, tracking, set)`: compara un set recién completado
    contra el baseline local y devuelve el PR nuevo si lo hay, o null. Se
    llama justo cuando el usuario marca ✓: si devuelve un PR, el caller
    muestra el toast y nosotros ACTUALIZAMOS el baseline en memoria para no
    re-notificar la misma marca al tocar otra serie.

  Alcance intencional: solo fuerza (`weight_reps` y `reps`). Para cardio no
  hay baseline (el backend tampoco lo devuelve) y detectPR retorna null.
*/

const PR_KIND = {
  heaviestKg: 'heaviestKg', // weight_reps: supera el peso máximo histórico
  best1RM: 'best1RM',       // weight_reps: supera el 1RM estimado histórico
  bestReps: 'bestReps',     // reps: supera el máximo de reps en una serie
}

function uniqueExerciseIds(session) {
  const ids = []
  for (const e of session?.entries ?? []) {
    const id = typeof e.exercise === 'string' ? e.exercise : e.exercise?._id
    if (id && !ids.includes(id)) ids.push(id)
  }
  return ids
}

export function useExerciseHistory(initialSession) {
  const [history, setHistory] = useState({})
  // Lazy initial: si la sesión no tiene ejercicios no hay nada que cargar,
  // así ahorramos un setLoading(false) síncrono dentro del effect (que
  // dispara el warn de react-hooks/set-state-in-effect).
  const [loading, setLoading] = useState(
    () => uniqueExerciseIds(initialSession).length > 0,
  )
  // Ref paralelo al state: `detectPR` lo consulta y muta en el mismo tick
  // tras disparar un toast — hacerlo con setState perdería races si el
  // usuario tickea dos series muy seguidas (no bloquea el toast correcto
  // pero fuerza re-renders innecesarios).
  const baselineRef = useRef({})

  useEffect(() => {
    let cancelled = false
    const ids = uniqueExerciseIds(initialSession)
    if (ids.length === 0) return undefined
    async function load() {
      try {
        const data = await api(
          `/api/exercises/history?ids=${encodeURIComponent(ids.join(','))}`,
        )
        if (cancelled) return
        setHistory(data)
        baselineRef.current = Object.fromEntries(
          Object.entries(data).map(([id, v]) => [id, { ...v.prs }]),
        )
      } catch {
        // Un fallo aquí NO rompe la sesión: sin history no hay prefill y no
        // hay PR toasts, pero el entreno se registra igual. Historial se
        // puede reintentar manualmente la próxima vez.
        if (!cancelled) setHistory({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // El _id de la sesión activa es estable durante su vida; no queremos
    // re-fetch al cambiar entries (añadir/quitar ejercicios mid-session
    // sirve el prefill que ya tenemos y el nuevo se queda sin baseline,
    // que es el comportamiento correcto: sin dato histórico no inventamos).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession?._id])

  /*
    Devuelve el PR detectado (o null). Muta el baseline local para que una
    serie posterior del mismo tipo no re-dispare el toast. Idempotente:
    llamarlo dos veces con el mismo set devuelve null la segunda.
  */
  const detectPR = (exerciseId, tracking, set) => {
    if (!exerciseId) return null
    const base = baselineRef.current[exerciseId]
    if (!base) return null

    if (tracking === 'weight_reps') {
      let hit = null
      if (set.weightKg != null && (base.heaviestKg == null || set.weightKg > base.heaviestKg)) {
        hit = { kind: PR_KIND.heaviestKg, value: set.weightKg }
        base.heaviestKg = set.weightKg
      }
      if (set.weightKg != null && set.reps != null) {
        const oneRm = Math.round(estimate1RM(set.weightKg, set.reps) * 10) / 10
        if (oneRm > 0 && (base.best1RM == null || oneRm > base.best1RM)) {
          // Si ya detectamos heaviest, nos quedamos con el "más llamativo"
          // (heaviest es un hecho duro; 1RM es estimación). Un solo toast
          // por check evita que la pantalla parpadee con dos burbujas
          // apiladas en la misma acción del usuario.
          if (!hit) hit = { kind: PR_KIND.best1RM, value: oneRm }
          base.best1RM = oneRm
        }
      }
      return hit
    }

    if (tracking === 'reps') {
      if (set.reps != null && (base.bestReps == null || set.reps > base.bestReps)) {
        base.bestReps = set.reps
        return { kind: PR_KIND.bestReps, value: set.reps }
      }
    }

    return null
  }

  return { history, loading, detectPR }
}

export { PR_KIND }
