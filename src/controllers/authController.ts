// authController
//
// Controllers in this project are the single seam between UI components and
// data. This file now talks to the real database via /api/auth/login,
// instead of the old mock data in src/data/users.ts.

export type UserRole = 'admin' | 'customer' | 'c'

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
export async function login(email: string, password: string, remember = false): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })

    const data = await res.json()
    return data as LoginResult
  } catch (err) {
    console.error('Login request failed:', err)
    return { success: false, message: 'Unable to reach the server.' }
  }
}

/** Clears the browser's session flags and has the server take back the login cookie. */
export async function logout() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('autokita_admin')
  sessionStorage.removeItem('autokita_customer')
  sessionStorage.removeItem('autokita_user_id')
  localStorage.removeItem(REMEMBER_KEY)
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}

// "Keep me signed in": sessionStorage dies with the tab, so a copy goes in
// localStorage. A small script in app/layout.tsx copies it back into
// sessionStorage when a page opens, before any page reads it.
const REMEMBER_KEY = 'autokita_remember'
const REMEMBER_DAYS = 30

/** Persists the session flags for the given role + user id after a successful login. */
export function startSession(role: string, userId: number, remember = false) {
  if (typeof window === 'undefined') return
  const isCustomer = role === 'customer' || role === 'c'
  const flag = isCustomer ? 'autokita_customer' : 'autokita_admin'
  sessionStorage.setItem(flag, 'true')
  sessionStorage.setItem('autokita_user_id', String(userId))

  if (remember) {
    const exp = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ flag, userId, exp }))
  } else {
    localStorage.removeItem(REMEMBER_KEY)
  }
}