import { createAuthClient } from 'better-auth/react'
import { api } from './api.js'

// Better Auth client.
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? window.location.origin,
})

export const { useSession, signIn, signOut } = authClient

// Start OAuth sign-in for a provider.
export function signInWithProvider(provider) {
  return authClient.signIn.social({
    provider,
    callbackURL: `${window.location.origin}/home`,
  })
}

function unwrap({ data, error }) {
  if (error) {
    const err = new Error(error.message ?? error.statusText ?? 'auth error')
    err.status = error.status
    throw err
  }
  return data
}

// List the OAuth providers linked to the account.
export async function listLinkedProviders() {
  return unwrap(await authClient.listAccounts()) ?? []
}

// Sign in as the demo user.
export function signInAsDemo() {
  return api('/api/auth/demo', { method: 'POST' })
}

// Delete the account via Better Auth.
export async function deleteAccount() {
  return unwrap(await authClient.deleteUser())
}
