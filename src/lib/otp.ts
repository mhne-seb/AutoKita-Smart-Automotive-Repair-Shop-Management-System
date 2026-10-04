
import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { isVerificationBypassed } from '@/lib/testMode'

const TTL_MS = 10 * 60 * 1000 // 10 minutes

function secret(): string {
  const s = process.env.OTP_SECRET
  if (!s || s.length < 16) {
    throw new Error('OTP_SECRET is missing or too short — set a long random value in .env.local and Vercel')
  }
  return s
}

function sign(purpose: string, subject: string, exp: number, code: string): string {
  return createHmac('sha256', secret()).update(`${purpose}|${subject}|${exp}|${code}`).digest('base64url')
}

export function issueOtp(purpose: string, subject: string): { code: string; token: string; expiresAt: number } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const exp = Date.now() + TTL_MS
  const mac = sign(purpose, subject, exp, code)
  const token = Buffer.from(`${purpose}|${subject}|${exp}|${mac}`).toString('base64url')
  return { code, token, expiresAt: exp }
}

const attempts = new Map<string, { count: number; expiresAt: number }>()

export function verifyOtp(
  token: string,
  code: string,
  purpose: string,
  subject: string,
): { ok: true } | { ok: false; reason: 'expired' | 'invalid' | 'too_many_attempts' } {
  if (isVerificationBypassed()) {
    return { ok: true }
  }

  const attemptKey = `${purpose}:${subject}`
  const now = Date.now()

  // Clean up old attempts for this key if they've expired
  const record = attempts.get(attemptKey)
  if (record && now > record.expiresAt) {
    attempts.delete(attemptKey)
  } else if (record && record.count >= 5) {
    return { ok: false, reason: 'too_many_attempts' }
  }

  let parts: string[]
  try {
    parts = Buffer.from(token, 'base64url').toString('utf8').split('|')
  } catch {
    return recordFailure(attemptKey, now + TTL_MS)
  }
  if (parts.length !== 4) return recordFailure(attemptKey, now + TTL_MS)

  const [tPurpose, tSubject, tExp, mac] = parts
  const exp = Number(tExp)
  if (tPurpose !== purpose || tSubject !== subject || !Number.isFinite(exp)) {
    return recordFailure(attemptKey, exp > now ? exp : now + TTL_MS)
  }
  if (now > exp) return { ok: false, reason: 'expired' }

  const expected = sign(purpose, subject, exp, String(code).trim())
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return recordFailure(attemptKey, exp)
  }

  attempts.delete(attemptKey)
  return { ok: true }
}

function recordFailure(key: string, expiresAt: number): { ok: false; reason: 'invalid' } {
  const current = attempts.get(key)?.count || 0
  attempts.set(key, { count: current + 1, expiresAt })
  return { ok: false, reason: 'invalid' }
}

export const OTP_TTL_MINUTES = TTL_MS / 60_000

// Purposes are part of the signature, so a code issued for one action can't
// be replayed against another.
export const QUOTATION_OTP_PURPOSE = 'quotation-approve'
export const FINDING_OTP_PURPOSE = 'finding-approve'
