import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import { api } from './api.js'

// Exercise display names with user aliases.

function pickCanonical(exercise, lang) {
  if (typeof exercise?.exerciseName === 'string') return exercise.exerciseName
  const n = exercise?.name
  if (!n) return '—'
  if (typeof n === 'string') return n
  return n[lang] ?? n.es ?? n.en ?? '—'
}

function pickId(exercise) {
  const raw =
    exercise?._id ??
    exercise?.exerciseId ??
    (typeof exercise?.exercise === 'object'
      ? exercise.exercise?._id
      : exercise?.exercise)
  return raw ? String(raw) : null
}

function currentLang(i18nLang) {
  return i18nLang?.startsWith('en') ? 'en' : 'es'
}

// Hook returning the display name for an exercise.
export function useExerciseName(exercise) {
  const { user } = useUser()
  const { i18n } = useTranslation()
  const lang = currentLang(i18n.language)
  const aliases = user?.exerciseAliases ?? null
  const id = pickId(exercise)
  const alias = id && aliases ? aliases[id] : undefined
  const canonical = pickCanonical(exercise, lang)
  return {
    name: alias ?? canonical,
    canonical,
    isAliased: Boolean(alias),
  }
}

// Resolve an exercise display name from aliases and language.
export function resolveExerciseName(exercise, aliases, lang) {
  const id = pickId(exercise)
  const alias = id && aliases ? aliases[id] : undefined
  return alias ?? pickCanonical(exercise, lang ?? 'es')
}

// Hook for reading and setting an exercise alias.
export function useExerciseAlias(exerciseId) {
  const { user, updateUser } = useUser()
  const [saving, setSaving] = useState(false)
  const id = exerciseId ? String(exerciseId) : null
  const aliases = user?.exerciseAliases ?? {}
  const alias = useMemo(
    () => (id && typeof aliases[id] === 'string' ? aliases[id] : null),
    [aliases, id],
  )

  const applyLocal = useCallback(
    (updater) => {
      const next = updater(aliases)
      updateUser({ exerciseAliases: next })
    },
    [aliases, updateUser],
  )

  const setAlias = useCallback(
    async (nameRaw) => {
      if (!id) return
      const name = (nameRaw ?? '').trim()
      if (!name) return clear()
      const snapshot = aliases
      applyLocal((prev) => ({ ...prev, [id]: name }))
      setSaving(true)
      try {
        const res = await api(`/api/me/aliases/${id}`, {
          method: 'PUT',
          body: { name },
        })
        if (res?.exerciseAliases) {
          updateUser({ exerciseAliases: res.exerciseAliases })
        }
      } catch (err) {
        updateUser({ exerciseAliases: snapshot })
        throw err
      } finally {
        setSaving(false)
      }
    },
    [id, aliases, applyLocal, updateUser],
  )

  const clear = useCallback(async () => {
    if (!id) return
    const snapshot = aliases
    applyLocal((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSaving(true)
    try {
      const res = await api(`/api/me/aliases/${id}`, { method: 'DELETE' })
      if (res?.exerciseAliases) {
        updateUser({ exerciseAliases: res.exerciseAliases })
      }
    } catch (err) {
      updateUser({ exerciseAliases: snapshot })
      throw err
    } finally {
      setSaving(false)
    }
  }, [id, aliases, applyLocal, updateUser])

  return { alias, setAlias, clear, saving }
}
