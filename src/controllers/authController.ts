
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
  title?: string | null // staff job title, e.g. "Finance Adviser"; null for customers
  message?: string
}

// Who's logged in, for display only (sidebar, greeting) — never for access decisions.
export interface DisplayProfile {
  name: string
  title: string | null
}

export function getDisplayProfile(): DisplayProfile | null {
  if (typeof window === 'undefined') return null
  const name = sessionStorage.getItem('autokita_user_name')
  return name ? { name, title: sessionStorage.getItem('autokita_user_title') } : null
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
export async function logout(role?: 'admin' | 'customer' | 'staff') {
  if (typeof window === 'undefined') return
  const isCust = role === 'customer'
  const isAdm = role === 'admin' || role === 'staff'

  if (isCust) {
    sessionStorage.removeItem('autokita_customer')
    const r = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null')
    if (r?.flag === 'autokita_customer') {
      localStorage.removeItem(REMEMBER_KEY)
      sessionStorage.removeItem('autokita_user_id')
      sessionStorage.removeItem('autokita_user_name')
      sessionStorage.removeItem('autokita_user_title')
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'customer' }),
    }).catch(() => {})
  } else if (isAdm) {
    sessionStorage.removeItem('autokita_admin')
    sessionStorage.removeItem('autokita_user_title')
    const r = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null')
    if (r?.flag === 'autokita_admin') {
      localStorage.removeItem(REMEMBER_KEY)
      sessionStorage.removeItem('autokita_user_id')
      sessionStorage.removeItem('autokita_user_name')
    }
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'staff' }),
    }).catch(() => {})
  } else {
    sessionStorage.removeItem('autokita_admin')
    sessionStorage.removeItem('autokita_customer')
    sessionStorage.removeItem('autokita_user_id')
    sessionStorage.removeItem('autokita_user_name')
    sessionStorage.removeItem('autokita_user_title')
    localStorage.removeItem(REMEMBER_KEY)
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }
}

// "Keep me signed in": sessionStorage dies with the tab, so a copy goes in
// localStorage. A small script in app/layout.tsx copies it back into
// sessionStorage when a page opens, before any page reads it.
const REMEMBER_KEY = 'autokita_remember'
const REMEMBER_DAYS = 30

/** Persists the session flags for the given role + user id after a successful login. */
export function startSession(role: string, userId: number, remember = false, profile: DisplayProfile | null = null) {
  if (typeof window === 'undefined') return
  const isCustomer = role === 'customer' || role === 'c'
  const flag = isCustomer ? 'autokita_customer' : 'autokita_admin'
  sessionStorage.setItem(flag, 'true')
  sessionStorage.setItem('autokita_user_id', String(userId))
  if (profile) {
    sessionStorage.setItem('autokita_user_name', profile.name)
    if (profile.title) sessionStorage.setItem('autokita_user_title', profile.title)
    else sessionStorage.removeItem('autokita_user_title')
  }

  if (remember) {
    const exp = Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(REMEMBER_KEY, JSON.stringify({ flag, userId, exp, name: profile?.name ?? null, title: profile?.title ?? null }))
  } else {
    localStorage.removeItem(REMEMBER_KEY)
  }
}

/** Where a visitor who is already signed in on this tab belongs, or null when nobody is signed in. */
export function signedInHome(): string | null {
  if (typeof window === 'undefined') return null
  if (sessionStorage.getItem('autokita_admin') === 'true') return '/overview'
  if (sessionStorage.getItem('autokita_customer') === 'true') return '/dashboard'
  return null
}

/** Forgets the 30-day "Keep me signed in" record for one role, once the server says that login is no longer valid. */
export function forgetRememberedLogin(flag: 'autokita_customer' | 'autokita_admin') {
  if (typeof window === 'undefined') return
  try {
    const r = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null')
    if (r?.flag === flag) localStorage.removeItem(REMEMBER_KEY)
  } catch {
    // A broken record is as good as none.
  }
}