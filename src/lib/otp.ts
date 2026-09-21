// otp.ts — one-time codes for 2FA, without a database table.
//
// The server issues a 6-digit code and a signed token. The token carries what
// the code is FOR (purpose + subject) and WHEN it expires, plus an HMAC over
// all of that AND the code itself. The code goes to the customer by email; the
// token goes back to the browser (it reveals nothing — the code isn't in it).
// To verify, the browser sends token + typed code, and we recompute the HMAC.
// If it matches, that exact code was issued for that exact purpose and hasn't
// expired. Same idea as a signed password-reset link.
//
// Trade-off vs. a table: a code can be verified more than once inside its
// 10-minute window. Every action that uses this is idempotent (e.g. confirming
// a quotation refuses a second time), so a replay can't do anything new.

import { createHmac, randomInt, timingSafeEqual } from 'crypto'

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

export function verifyOtp(
  token: string,
  code: string,
  purpose: string,
  subject: string,
): { ok: true } | { ok: false; reason: 'expired' | 'invalid' } {
  let parts: string[]
  try {
    parts = Buffer.from(token, 'base64url').toString('utf8').split('|')
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (parts.length !== 4) return { ok: false, reason: 'invalid' }

  const [tPurpose, tSubject, tExp, mac] = parts
  const exp = Number(tExp)
  if (tPurpose !== purpose || tSubject !== subject || !Number.isFinite(exp)) {
    return { ok: false, reason: 'invalid' }
  }
  if (Date.now() > exp) return { ok: false, reason: 'expired' }

  const expected = sign(purpose, subject, exp, String(code).trim())
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' }

  return { ok: true }
}

export const OTP_TTL_MINUTES = TTL_MS / 60_000

// Purposes are part of the signature, so a code issued for one action can't
// be replayed against another.
export const QUOTATION_OTP_PURPOSE = 'quotation-approve'
export const FINDING_OTP_PURPOSE = 'finding-approve'
