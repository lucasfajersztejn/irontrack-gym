import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '../contexts/UserContext.jsx'
import { api } from './api.js'

/*
  Nombre a mostrar para un ejercicio, respetando el renombre que el usuario
  haya hecho (user.exerciseAliases). Un único punto de verdad: el display de
  catálogo, picker, editor, sesión y stats semanales pasa por aquí.

  El renombre es solo capa de presentación (ver spec §1 — "la DB guarda en
  unidades base"): nunca se escribe al nombre canónico, nunca sale en los
  snapshots de Session.entries.exerciseName.

  Acepta tres formas de "ejercicio":
  1) Documento completo del catálogo: `{ _id, name: {es, en}, ... }`
  2) Entry de Session (populate off o denormalizado):
     `{ exercise: ObjectId|{_id}, exerciseName: string }`
  3) Objeto plano con `.exerciseName` ya resuelto (p.ej. stats semanales).
*/

function pickCanonical(exercise, lang) {
  // Nombre snapshot de un entry de sesión antigua (string plano).
  if (typeof exercise?.exerciseName === 'string') return exercise.exerciseName
  const n = exercise?.name
  if (!n) return '—'
  if (typeof n === 'string') return n
  return n[lang] ?? n.es ?? n.en ?? '—'
}

function pickId(exercise) {
  // Un entry de sesión guarda el ref en `.exercise`; un documento tiene `._id`
  // directo. Normalizamos a string porque las claves del Map vienen así del
  // backend.
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

/*
  Hook para pintar el nombre. Devuelve el alias si existe, el canónico si no,
  y una bandera `isAliased` por si queremos mostrar el nombre original debajo.
*/
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

/*
  Variante no-hook para contextos donde ya tenemos user y lang (helpers que
  arman datos derivados en un loop, p. ej. breakdownForSession).
*/
export function resolveExerciseName(exercise, aliases, lang) {
  const id = pickId(exercise)
  const alias = id && aliases ? aliases[id] : undefined
  return alias ?? pickCanonical(exercise, lang ?? 'es')
}

/*
  Editor del alias: optimista + rollback, mismo patrón que useFavorites. El
  endpoint responde solo `{ exerciseAliases }`, UserContext.updateUser merge
  local — nada de refetch de /api/me.
*/
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
