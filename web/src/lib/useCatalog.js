import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

/*
  Catálogo: una sola consulta a GET /api/exercises por combinación de filtros.
  El backend ya acepta muscle / bodyPart / equipment / search / mine y devuelve
  hasta 200 resultados ordenados por name.es. Devolver más no tiene sentido en
  la UI: ningún usuario va a hacer scroll por 1300 cards buscando algo; se
  acota con el buscador o con los pills.

  Dos matices:
  - El search va con debounce de 300 ms para no disparar un fetch por letra.
  - Un filtro que cambia mientras el fetch anterior está en vuelo invalida el
    resultado viejo con una referencia-token: así, si el usuario mueve rápido
    el filtro, no vemos "parpadear" datos obsoletos.
*/

const DEBOUNCE_MS = 300

function buildQuery(filters) {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.bodyPart) params.set('bodyPart', filters.bodyPart)
  if (filters.equipment) params.set('equipment', filters.equipment)
  if (filters.muscle) params.set('muscle', filters.muscle)
  if (filters.mine) params.set('mine', '1')
  if (filters.favorites) params.set('favorites', '1')
  const qs = params.toString()
  return qs ? `/api/exercises?${qs}` : '/api/exercises'
}

export function useCatalog(filters) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    exercises: [],
  })

  // Debounce del search sin tocar el objeto filters: así el debounce es local
  // y los otros filtros disparan al instante.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters.search])

  // Token de carrera: incrementa en cada efecto; cuando llega el fetch solo
  // aplica el resultado si sigue siendo el token activo.
  const tokenRef = useRef(0)

  // Nonce para refetch manual (crear un custom): subir el contador reactiva
  // el effect sin forzar al caller a mutar filtros reales.
  const [refetchNonce, setRefetchNonce] = useState(0)

  useEffect(() => {
    const myToken = ++tokenRef.current
    setState((s) => ({ ...s, loading: true, error: null }))
    const effectiveFilters = { ...filters, search: debouncedSearch }
    api(buildQuery(effectiveFilters))
      .then((exercises) => {
        if (myToken !== tokenRef.current) return
        setState({ loading: false, error: null, exercises })
      })
      .catch((err) => {
        if (myToken !== tokenRef.current) return
        setState({ loading: false, error: err, exercises: [] })
      })
    // Dependemos explícitamente de cada filtro (y del search debounced) para
    // que un cambio no amortiguado dispare el fetch sin esperar al timeout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.bodyPart, filters.equipment, filters.muscle, filters.mine, filters.favorites, refetchNonce])

  const refetch = () => setRefetchNonce((n) => n + 1)

  return { ...state, refetch }
}
