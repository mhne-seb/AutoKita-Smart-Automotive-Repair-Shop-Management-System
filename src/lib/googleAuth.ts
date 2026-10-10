import { SignJWT, jwtVerify, createRemoteJWKSet } from 'jose'
import crypto from 'crypto'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_APP_URL)
}

export function redirectUri(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || ''
  return `${url.replace(/\/$/, '')}/api/auth/google/callback`
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export function buildAuthUrl({ state, nonce, challenge }: { state: string, nonce: string, challenge: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    code,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    throw new Error(`Failed to exchange code: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  return data.id_token
}

export async function verifyIdToken(idToken: string, expectedNonce: string) {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID!,
    algorithms: ['RS256'],
  })

  if (payload.nonce !== expectedNonce) {
    throw new Error('Nonce mismatch')
  }
  if (payload.email_verified !== true) {
    throw new Error('Email not verified')
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Missing sub')
  }
  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('Missing email')
  }
  if (payload.email.length > 80) {
    throw new Error('Email too long')
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    givenName: typeof payload.given_name === 'string' ? payload.given_name : '',
    familyName: typeof payload.family_name === 'string' ? payload.family_name : '',
    name: typeof payload.name === 'string' ? payload.name : '',
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET is missing or shorter than 32 characters')
  return new TextEncoder().encode(secret)
}

export type GoogleOauthCookie = { state: string, nonce: string, verifier: string, remember: boolean, returnTo?: 'login' | 'book' }
export type GoogleSignupCookie = { sub: string, email: string, firstName: string, lastName: string, remember: boolean, returnTo?: 'login' | 'book' }

const OAUTH_COOKIE = 'autokita_google_oauth'
const SIGNUP_COOKIE = 'autokita_google_signup'

export async function signOauthCookie(data: GoogleOauthCookie): Promise<string> {
  return new SignJWT({ ...data, purpose: 'google-oauth' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secretKey())
}

export async function readOauthCookie(token: string | undefined): Promise<GoogleOauthCookie | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.purpose !== 'google-oauth') return null
    const cookie = payload as unknown as GoogleOauthCookie
    if (!cookie.returnTo) cookie.returnTo = 'login'
    return cookie
  } catch {
    return null
  }
}

export async function signSignupCookie(data: GoogleSignupCookie): Promise<string> {
  return new SignJWT({ ...data, purpose: 'google-signup' } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secretKey())
}

export async function readSignupCookie(token: string | undefined): Promise<GoogleSignupCookie | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (payload.purpose !== 'google-signup') return null
    const cookie = payload as unknown as GoogleSignupCookie
    if (!cookie.returnTo) cookie.returnTo = 'login'
    return cookie
  } catch {
    return null
  }
}

export const oauthCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth/google',
}

export const signupCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}
