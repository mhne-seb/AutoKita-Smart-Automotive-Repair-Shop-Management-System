import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, STAFF_SESSION_COOKIE, CUSTOMER_SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

// Takes the wristband back: an expired, empty cookie replaces it.
export async function POST(req: NextRequest) {
  let role: string | null = null
  try {
    const body = await req.json().catch(() => ({}))
    role = body?.role ?? null
  } catch {}

  if (!role) {
    role = req.nextUrl.searchParams.get('role')
  }

  const res = NextResponse.json({ success: true })
  const expired = { ...sessionCookieOptions, maxAge: 0 }

  if (role === 'staff' || role === 'admin') {
    res.cookies.set(STAFF_SESSION_COOKIE, '', expired)
    // Only expire legacy if it was a staff session
    res.cookies.set(SESSION_COOKIE, '', expired)
  } else if (role === 'customer') {
    res.cookies.set(CUSTOMER_SESSION_COOKIE, '', expired)
    res.cookies.set(SESSION_COOKIE, '', expired)
  } else {
    // Blanket logout
    res.cookies.set(STAFF_SESSION_COOKIE, '', expired)
    res.cookies.set(CUSTOMER_SESSION_COOKIE, '', expired)
    res.cookies.set(SESSION_COOKIE, '', expired)
  }

  return res
}
