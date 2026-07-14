// authController
//
// Controllers in this project are the single seam between UI components and
// data. Right now every function here reads from src/data/*.ts (mock data)


import { findUserByCredentials, type MockUser, type UserRole } from '@/data/users'

export interface LoginResult {
  success: boolean
  user?: MockUser
  role?: UserRole
  message?: string
}

// Simulates network latency so loading states can be exercised even against
// mock data.
function simulateDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * Attempts to log a user in and reports which role they belong to, so the
 * caller (the unified /login page) knows whether to redirect to the Customer
 * dashboard or the Admin dashboard.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await res.json()
    return simulateDelay(data)
  } catch (error) {
    return simulateDelay({ success: false, message: 'Network error occurred.' })
  }
}

/** Clears whichever mock session flag is currently set. */
export function logout() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('autokita_admin')
  sessionStorage.removeItem('autokita_customer')
}

/** Persists the mock session flag for the given role after a successful login. */
export function startSession(role: UserRole, userId?: string | number) {
  if (typeof window === 'undefined') return
  if (role === 'admin') sessionStorage.setItem('autokita_admin', 'true')
  else sessionStorage.setItem('autokita_customer', 'true')
  
  if (userId) {
    sessionStorage.setItem('autokita_user_id', String(userId))
  }
}
