import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { useUser } from '../contexts/UserContext.jsx'

/*
  Escritura de preferencias del usuario contra PATCH /api/me/settings.

  Tres decisiones que vale la pena defender:

  1. **Sin botón de guardar.** Son cinco controles independientes, no un
     formulario con un resultado conjunto: un toggle de idioma no necesita
     que confirmes nada. Cada cambio sale solo, y el feedback ("Guardado")
     vive junto a la sección que acabas de tocar.

  2. **Optimista con rollback.** Pintamos el valor nuevo antes de que
     responda el servidor y lo revertimos si falla. El endpoint devuelve
     `{ settings }`, así que al terminar mezclamos la respuesta del servidor
     sin pedir `/api/me` otra vez — un refetch pone `loading: true` en
     UserContext y hace parpadear toda la app (ver optimistic-user-updates).

  3. **Un único campo en vuelo a la vez.** No es un lock: es que el estado
     de "guardando" se guarda por clave, así que dos cambios simultáneos se
     pisan el indicador pero no los datos (cada PATCH lleva solo su campo y
     el backend hace `$set` con notación dot).

  El estado de "Guardado" se borra solo a los 2 s. El timeout se limpia al
  desmontar y antes de rearmarlo: sin eso, salir de Ajustes a mitad de un
  guardado deja un setState apuntando a un componente que ya no existe.
*/

const SAVED_FEEDBACK_MS = 2000

export function useSettings() {
  const { user, updateUser } = useUser()
  const settings = user?.settings ?? {}

  const [savingKey, setSavingKey] = useState(null)
  const [savedKey, setSavedKey] = useState(null)
  // { key, message } — el error se muestra pegado al campo que lo provocó.
  const [error, setError] = useState(null)

  const savedTimer = useRef(null)
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const save = useCallback(
    async (key, value) => {
      // Snapshot para el rollback. Se toma del objeto que ya tenemos en
      // contexto, no del render: si el PATCH falla queremos volver EXACTO
      // al valor que el usuario veía antes de tocar el control.
      const previous = user?.settings ?? {}
      if (previous[key] === value) return

      setSavingKey(key)
      setSavedKey(null)
      setError(null)
      updateUser({ settings: { ...previous, [key]: value } })

      try {
        const res = await api('/api/me/settings', {
          method: 'PATCH',
          body: { [key]: value },
        })
        // El servidor manda el subdocumento completo y validado: es la
        // versión que gana sobre la que pintamos en optimista.
        if (res?.settings) updateUser({ settings: res.settings })
        setSavedKey(key)
        clearTimeout(savedTimer.current)
        savedTimer.current = setTimeout(() => setSavedKey(null), SAVED_FEEDBACK_MS)
      } catch (err) {
        updateUser({ settings: previous })
        setError({ key, message: err.payload?.message ?? err.message })
      } finally {
        setSavingKey(null)
      }
    },
    [updateUser, user?.settings],
  )

  return { settings, save, savingKey, savedKey, error }
}
