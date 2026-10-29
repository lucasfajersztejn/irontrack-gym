/*
  Fetch wrapper. `credentials: 'include'` es obligatorio para que viaje la
  cookie `better-auth.session_token`. El backend exige `Origin` en escrituras
  por CSRF (spec §3.6): fetch del navegador la añade sola, así que no la
  seteamos a mano.
*/

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
    const err = new Error(data?.error ?? res.statusText)
    err.status = res.status
    err.payload = data
    throw err
  }

  return data
}
