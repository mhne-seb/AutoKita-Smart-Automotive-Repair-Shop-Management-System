// ---------------------------------------------------------------------------
// Mock authentication data for the unified login page.
//
// In a real backend this would live in a `users` table and passwords would be
// hashed (bcrypt/argon2) and checked server-side. For this frontend-only demo,
// we keep a small in-memory list here so the login page has something to
// match against and can auto-detect whether to send the person to the
// Customer dashboard or the Admin dashboard.
//
// Swap `findUserByCredentials` for a real `POST /api/auth/login` call once
// the backend exists — every caller already treats it as an async-shaped
// operation (see src/controllers/authController.ts), so the swap is
// mechanical.
// ---------------------------------------------------------------------------

export type UserRole = 'customer' | 'admin'

export interface MockUser {
  id: string
  name: string
  email: string
  password: string // plain text ONLY because this is mock/demo data
  role: UserRole
}

export const mockUsers: MockUser[] = [
  {
    id: 'CUST-2026-1234',
    name: 'Juan Dela Cruz',
    email: 'customer@autocare.com',
    password: 'password',
    role: 'customer',
  },
  {
    id: 'ADMIN-0001',
    name: 'Boss Boyet',
    email: 'admin@autokita.com',
    password: 'autokita2026',
    role: 'admin',
  },
]

/** Looks up a mock user by email + password, case-insensitive on email. */
export function findUserByCredentials(email: string, password: string): MockUser | null {
  const normalized = email.trim().toLowerCase()
  const user = mockUsers.find((u) => u.email.toLowerCase() === normalized)
  if (!user || user.password !== password) return null
  return user
}
