import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { SESSION_COOKIE, REMEMBER_MAX_AGE_SECONDS, createSessionToken, sessionCookieOptions, sessionSecretConfigured } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { email, password, remember } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 })
  }

  try {
    // Find the account by email only. The password check happens in code,
    // because a salted hash can't be compared inside the SQL.
    let isCustomer = true
    let result = await db.query(
      'SELECT id, email, nickname, first_name, last_name, role, password FROM users WHERE email = $1',
      [email]
    )
    if (result.rows.length === 0) {
      isCustomer = false
      result = await db.query(
        "SELECT id, email, full_name as nickname, split_part(full_name, ' ', 1) as first_name, split_part(full_name, ' ', 2) as last_name, role, password FROM employees WHERE email = $1",
        [email]
      )
    }

    const found = result.rows[0]
    if (!found || !(await verifyPassword(password, found.password))) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }

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
    })

    // The wristband. Which table the account came from decides the role —
    // customer #5 and employee #5 are different people.
    if (sessionSecretConfigured()) {
      const session = { userId: found.id, role: isCustomer ? 'customer' as const : 'staff' as const }
      if (remember === true) {
        const token = await createSessionToken(session, REMEMBER_MAX_AGE_SECONDS)
        res.cookies.set(SESSION_COOKIE, token, { ...sessionCookieOptions, maxAge: REMEMBER_MAX_AGE_SECONDS })
      } else {
        // No maxAge = the browser throws the cookie away when it closes.
        const { maxAge: _unused, ...untilBrowserCloses } = sessionCookieOptions
        res.cookies.set(SESSION_COOKIE, await createSessionToken(session), untilBrowserCloses)
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
