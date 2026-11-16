import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Hook for the filtered exercise catalog.

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

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [filters.search])

  const tokenRef = useRef(0)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters.bodyPart, filters.equipment, filters.muscle, filters.mine, filters.favorites, refetchNonce])

  const refetch = () => setRefetchNonce((n) => n + 1)

  return { ...state, refetch }
}
