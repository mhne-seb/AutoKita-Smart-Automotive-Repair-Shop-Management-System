import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import {
  SESSION_COOKIE,
  STAFF_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE,
  REMEMBER_MAX_AGE_SECONDS,
  createSessionToken,
  sessionCookieOptions,
  sessionSecretConfigured,
} from '@/lib/session'

// Lockout after repeated wrong passwords (paper: UC 8, Exception 1). Kept in
// memory, so each server instance counts on its own; that slows guessing down
// but is not a hard guarantee across several instances.
const MAX_WRONG_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000
const wrongAttempts = new Map<string, { count: number; firstAt: number }>()

function lockedForMinutes(key: string): number {
  const rec = wrongAttempts.get(key)
  if (!rec) return 0
  const age = Date.now() - rec.firstAt
  if (age > LOCK_MS) {
    wrongAttempts.delete(key)
    return 0
  }
  return rec.count >= MAX_WRONG_ATTEMPTS ? Math.ceil((LOCK_MS - age) / 60000) : 0
}

function recordWrongAttempt(key: string) {
  if (wrongAttempts.size > 2000) wrongAttempts.clear() // keep memory small
  const rec = wrongAttempts.get(key)
  if (!rec || Date.now() - rec.firstAt > LOCK_MS) wrongAttempts.set(key, { count: 1, firstAt: Date.now() })
  else rec.count += 1
}

export async function POST(req: NextRequest) {
  const { email: rawEmail, password, remember } = await req.json()

  if (!rawEmail || !password) {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 })
  }
  const email = String(rawEmail).trim()
  const attemptKey = email.toLowerCase()

  const wait = lockedForMinutes(attemptKey)
  if (wait > 0) {
    return NextResponse.json(
      { success: false, message: `Too many wrong attempts. Please try again in ${wait} minute${wait === 1 ? '' : 's'}.` },
      { status: 429 },
    )
  }

  try {
    // Find the account by email. We check employees first so staff accounts
    // cannot be overshadowed or demoted by a user record.
    let isCustomer = false
    let result = await db.query(
      "SELECT id, email, full_name as nickname, split_part(full_name, ' ', 1) as first_name, split_part(full_name, ' ', 2) as last_name, role, password FROM employees WHERE LOWER(email) = LOWER($1) ORDER BY (email = $1) DESC LIMIT 1",
      [email]
    )
    if (result.rows.length === 0) {
      isCustomer = true
      result = await db.query(
        'SELECT id, email, nickname, first_name, last_name, role, password FROM users WHERE LOWER(email) = LOWER($1) ORDER BY (email = $1) DESC LIMIT 1',
        [email]
      )
    }

    const found = result.rows[0]
    if (!found || !(await verifyPassword(password, found.password))) {
      recordWrongAttempt(attemptKey)
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }
    wrongAttempts.delete(attemptKey)

    // Never send the hash back to the browser.
    const user = { ...found }
    delete user.password
    const rawRole = user.role?.trim()?.toLowerCase()
    // Live database users.role is 'c' (or 'customer'). Employees have roles: owner, mechanic, etc.
    const resolvedRole = isCustomer || rawRole === 'c' || rawRole === 'customer' ? 'customer' : 'admin'

    const res = NextResponse.json({
      success: true,
      user: {
        ...user,
        role: resolvedRole,
      },
      role: resolvedRole,
      // What the admin sidebar shows under the name, e.g. "finance_adviser" -> "Finance Adviser".
      title: isCustomer ? null : String(rawRole ?? 'staff').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    })

    // The wristband. Set role-specific cookie so staff and customer do not evict each other
    if (sessionSecretConfigured()) {
      const session = { userId: found.id, role: isCustomer ? 'customer' as const : 'staff' as const }
      const roleCookieName = isCustomer ? CUSTOMER_SESSION_COOKIE : STAFF_SESSION_COOKIE
      const cookieAge = remember === true ? REMEMBER_MAX_AGE_SECONDS : undefined
      const token = await createSessionToken(session, cookieAge)

      if (remember === true) {
        res.cookies.set(roleCookieName, token, { ...sessionCookieOptions, maxAge: REMEMBER_MAX_AGE_SECONDS })
        res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, maxAge: REMEMBER_MAX_AGE_SECONDS })
      } else {
        const { maxAge: _unused, ...untilBrowserCloses } = sessionCookieOptions
        res.cookies.set(roleCookieName, token, untilBrowserCloses)
        res.cookies.set(SESSION_COOKIE, token, untilBrowserCloses)
      }
    } else {
      console.warn('SESSION_SECRET is not set — logged in without a session cookie (see .env.example).')
    }
    return res
  } catch (err) {
    console.error('Login query failed:', err)
    return NextResponse.json({ success: false, message: 'Something went wrong.' }, { status: 500 })
  }
}
