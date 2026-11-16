// User context: loads the current user and exposes it with optimistic local updates.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import i18n from '../i18n/index.js'
import { api } from '../lib/api.js'
import { listLinkedProviders } from '../lib/auth.js'

const UserContext = createContext({
  user: null,
  loading: true,
  isAuthed: false,
  needsOnboarding: false,
  linkedProviders: [],
  refetch: () => {},
  updateUser: () => {},
  clearUser: () => {},
})

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [linkedProviders, setLinkedProviders] = useState([])

  const fetchMe = useCallback(async () => {
    setLoading(true)
    try {
      const me = await api('/api/me')
      setUser(me)
    } catch (err) {
      if (err.status !== 401) {
        console.error('GET /api/me falló:', err)
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  useEffect(() => {
    if (!user) {
      setLinkedProviders([])
      return
    }
    let alive = true
    listLinkedProviders()
      .then((accounts) => {
        if (alive) setLinkedProviders(accounts.map((a) => a.providerId))
      })
      .catch(() => {
        if (alive) setLinkedProviders([])
      })
    return () => {
      alive = false
    }
  }, [user?.id])

  useEffect(() => {
    const locale = user?.settings?.locale
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale)
    }
  }, [user?.settings?.locale])

  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev))
  }, [])

  const clearUser = useCallback(() => {
    setUser(null)
    setLoading(false)
  }, [])

  const value = {
    user,
    loading,
    isAuthed: !!user,
    needsOnboarding: !!user?.needsOnboarding,
    linkedProviders,
    refetch: fetchMe,
    updateUser,
    clearUser,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  return useContext(UserContext)
}
