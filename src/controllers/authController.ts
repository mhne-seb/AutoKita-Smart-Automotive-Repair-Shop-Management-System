// authController
//
// Controllers in this project are the single seam between UI components and
// data. This file now talks to the real database via /api/auth/login,
// instead of the old mock data in src/data/users.ts.

export type UserRole = 'admin' | 'customer'

export interface AuthUser {
  id: number
  email: string
  nickname: string
  first_name: string | null
  last_name: string | null
  role: string
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  role?: UserRole
  message?: string
}

/**
 * Attempts to log a user in against the real database and reports which
 * role they belong to, so the caller (the unified /login page) knows
 * whether to redirect to the Customer dashboard or the Admin dashboard.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    return data as LoginResult
  } catch (err) {
    console.error('Login request failed:', err)
    return { success: false, message: 'Unable to reach the server.' }
  }
}

/** Clears whichever session flags are currently set. */
export function logout() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('autokita_admin')
  sessionStorage.removeItem('autokita_customer')
  sessionStorage.removeItem('autokita_user_id')
}

/** Persists the session flags for the given role + user id after a successful login. */
export function startSession(role: string, userId: number) {
  if (typeof window === 'undefined') return
  if (role !== 'customer') sessionStorage.setItem('autokita_admin', 'true')
  else sessionStorage.setItem('autokita_customer', 'true')
  sessionStorage.setItem('autokita_user_id', String(userId))
}