import { api } from './api.js'

// Start a session from a routine, or rehydrate the active one.
export async function startSession(routineId) {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    const created = await api('/api/sessions', {
      method: 'POST',
      body: routineId ? { routine: routineId, timeZone } : { timeZone },
    })
    return created
  } catch (err) {
    if (err?.status === 409) {
      return await api('/api/sessions/active')
    }
    throw err
  }
}
