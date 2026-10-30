import { useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Datos del heatmap. Vive aparte de useHomeData porque el rango temporal
  cambia a demanda del usuario (12 semanas, este año, un año anterior) y
  disparar un refetch global por cambiar de pestaña sería un desperdicio.

  Dos hooks:
  - useHeatmap(range)        → paginación completa de sesiones en el rango.
  - useAvailableHeatmapRanges() → probe de años anteriores con datos.

  Decisiones:
  - "12w" vive siempre, apunta a las últimas 12 semanas ISO (lunes-domingo).
  - Un año abarca de la semana ISO que contiene el 1 de enero a la que
    contiene el 31 de diciembre; los días fuera del año se devuelven como
    isOutside=true para que el render los pinte invisibles pero mantenga la
    rejilla alineada a lunes.
  - El backend ordena sesiones por startedAt desc sin exponer total. Para
    agotar un rango se pagina hasta encontrar una página con < limit filas.
    Techo defensivo de 50 páginas (= 2500 sesiones) por si algo va mal.
  - El probe de años anteriores lanza una petición por año con limit=1 hasta
    el primer año sin datos (máx 4 años atrás): un usuario recién registrado
    hace una sola petición y no "ve" años pasados.
*/

const MAX_PAGES = 50
const MAX_YEARS_BACK = 4

function startOfLocalDay(d) {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function dayFromMon(d) {
  return (d.getDay() + 6) % 7 // 0 = lunes … 6 = domingo
}

function toLocalDayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function resolveHeatmapRange(range, today = new Date()) {
  const t = startOfLocalDay(today)
  if (range === '12w') {
    const end = addDays(t, 6 - dayFromMon(t))
    const start = addDays(end, -(12 * 7 - 1))
    return { start, end, year: null }
  }
  const year = Number(range)
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const start = addDays(jan1, -dayFromMon(jan1))
  const end = addDays(dec31, 6 - dayFromMon(dec31))
  return { start, end, year }
}

async function fetchAllSessionsInRange(from, to) {
  const all = []
  const fromIso = encodeURIComponent(from.toISOString())
  const toIso = encodeURIComponent(to.toISOString())
  for (let page = 1; page <= MAX_PAGES; page++) {
    const resp = await api(
      `/api/sessions?limit=50&page=${page}&from=${fromIso}&to=${toIso}`,
    )
    const items = Array.isArray(resp) ? resp : (resp?.sessions ?? [])
    all.push(...items)
    if (items.length < 50) break
  }
  return all
}

function buildCells(sessions, start, end, today, year) {
  const localToday = startOfLocalDay(today)
  const todayKey = toLocalDayKey(localToday)
  const counts = new Map()
  for (const s of sessions) {
    const key = toLocalDayKey(new Date(s.startedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const totalDays = Math.round((end - start) / 86400000) + 1
  const cells = []
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(start, i)
    const key = toLocalDayKey(d)
    const isFuture = d > localToday
    const isOutside = year != null && d.getFullYear() !== year
    cells.push({
      date: d,
      dateKey: key,
      count: isFuture || isOutside ? 0 : (counts.get(key) ?? 0),
      isFuture,
      isOutside,
      isToday: key === todayKey,
    })
  }
  return cells
}

export function useHeatmap(range, today = new Date()) {
  const [state, setState] = useState({
    loading: true,
    cells: [],
    weeks: 0,
    year: null,
  })

  useEffect(() => {
    let cancelled = false
    const { start, end, year } = resolveHeatmapRange(range, today)
    setState((s) => ({ ...s, loading: true }))
    fetchAllSessionsInRange(start, end)
      .then((sessions) => {
        if (cancelled) return
        const cells = buildCells(sessions, start, end, today, year)
        setState({
          loading: false,
          cells,
          weeks: cells.length / 7,
          year,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, cells: [], weeks: 0, year })
      })
    return () => {
      cancelled = true
    }
    // today es un new Date() en el render del padre; dependemos solo de range
    // para no refetchear por cada tick de reloj. Si el usuario deja la pestaña
    // abierta pasada la medianoche, un click a otro rango refresca sin más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  return state
}

export function useAvailableHeatmapRanges(today = new Date()) {
  const currentYear = today.getFullYear()
  const [state, setState] = useState({
    loading: true,
    ranges: ['12w', currentYear],
  })

  useEffect(() => {
    let cancelled = false
    async function probe() {
      const ranges = ['12w', currentYear]
      for (let delta = 1; delta <= MAX_YEARS_BACK; delta++) {
        const y = currentYear - delta
        const from = new Date(y, 0, 1)
        const to = new Date(y, 11, 31, 23, 59, 59)
        try {
          const resp = await api(
            `/api/sessions?limit=1&from=${encodeURIComponent(
              from.toISOString(),
            )}&to=${encodeURIComponent(to.toISOString())}`,
          )
          const items = Array.isArray(resp) ? resp : (resp?.sessions ?? [])
          if (items.length === 0) break
          ranges.push(y)
        } catch {
          break
        }
      }
      if (cancelled) return
      setState({ loading: false, ranges })
    }
    probe()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
