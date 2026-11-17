// Fetch wrapper that sends the session cookie.

const BASE = import.meta.env.VITE_API_URL ?? ''

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    const err = new Error(data?.message ?? res.statusText)
    err.status = res.status
    err.payload = data
    throw err
  }

  return data
}
