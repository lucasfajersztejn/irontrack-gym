import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

/*
  Devuelve la sesión activa del usuario (o null si no hay) + helpers para
  mutarla sin refetch. El backend contesta 200 con null cuando no hay sesión
  abierta (ver sessionController.getActiveSession): "nada abierto" es una
  respuesta válida, no un error.

  setSession permite al caller empujar al estado local el documento recibido
  tras un POST /api/sessions o un POST /:id/finish, para evitar un segundo
  round-trip que repintaría la UI con los mismos datos.
*/
export function useActiveSession() {
  const [state, setState] = useState({ loading: true, error: null, session: null })

  const refetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const session = await api('/api/sessions/active')
      setState({ loading: false, error: null, session })
    } catch (err) {
      setState({ loading: false, error: err, session: null })
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const setSession = useCallback((session) => {
    setState((s) => ({ ...s, session }))
  }, [])

  return { ...state, refetch, setSession }
}
