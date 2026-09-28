// session.ts — the login "wristband": a signed cookie the server hands out at
// login and checks later. Signed with SESSION_SECRET, so the browser can't
// read it (httpOnly) or change who it says you are without breaking the
// signature.
//
// users and employees are separate tables whose ids overlap (customer #5 and
// employee #5 are different people), so the role is part of the session.

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'autokita_session'
const MAX_AGE_SECONDS = 12 * 60 * 60
// "Keep me signed in" ticked.
export const REMEMBER_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type Session = { userId: number; role: 'customer' | 'staff' }

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is missing or shorter than 32 characters (see .env.example)')
  return new TextEncoder().encode(secret)
}

export function sessionSecretConfigured(): boolean {
  return (process.env.SESSION_SECRET?.length ?? 0) >= 32
}

export async function createSessionToken(session: Session, maxAgeSeconds = MAX_AGE_SECONDS): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey())
}

// Returns null for a missing, expired, tampered or malformed token — never throws.
export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token || !sessionSecretConfigured()) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const userId = Number(payload.sub)
    if ((payload.role !== 'customer' && payload.role !== 'staff') || !Number.isInteger(userId)) return null
    return { userId, role: payload.role }
  } catch {
    return null
  }
}

// For route handlers: who is making this request, according to the cookie.
export async function getSession(): Promise<Session | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value)
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  // Secure cookies only travel over https — off in dev so phone testing over
  // http://192.168.x.x:3000 still works.
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
}
