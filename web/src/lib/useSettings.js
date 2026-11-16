import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { useUser } from '../contexts/UserContext.jsx'

// Hook for user settings with optimistic updates.

const SAVED_FEEDBACK_MS = 2000

export function useSettings() {
  const { user, updateUser } = useUser()
  const settings = user?.settings ?? {}

  const [savingKey, setSavingKey] = useState(null)
  const [savedKey, setSavedKey] = useState(null)
  const [error, setError] = useState(null)

  const savedTimer = useRef(null)
  useEffect(() => () => clearTimeout(savedTimer.current), [])

  const save = useCallback(
    async (key, value) => {
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
