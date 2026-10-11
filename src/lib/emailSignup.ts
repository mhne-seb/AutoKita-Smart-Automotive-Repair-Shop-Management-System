import crypto from 'crypto'
import { EMAIL_RE } from './bookingRules'
import { passwordProblem } from './passwordPolicy'

export const CODE_TTL_MINUTES = 10
export const MAX_ATTEMPTS = 5
export const RESEND_SECONDS = 60
export const MAX_SENDS_PER_EMAIL_PER_HOUR = 3
export const MAX_SENDS_PER_IP_PER_HOUR = 10

export function makeCode(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export function hashCode(email: string, code: string): string {
  const secret = process.env.OTP_SECRET
  if (!secret) throw new Error('OTP_SECRET is missing')
  return crypto
    .createHmac('sha256', secret)
    .update(`signup|${email.toLowerCase()}|${code}`)
    .digest('hex')
}

export function verifyCodeHash(email: string, code: string, storedHash: string): boolean {
  try {
    const computed = hashCode(email, code)
    const a = Buffer.from(computed, 'hex')
    const b = Buffer.from(storedHash, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim().slice(0, 64)
  }
  const real = req.headers.get('x-real-ip')
  if (real) {
    return real.trim().slice(0, 64)
  }
  return 'unknown'
}

export function validateSignupFields({ firstName, lastName, email, password }: any) {
  const fName = String(firstName || '').trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '')
  const lName = String(lastName || '').trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '')
  const em = String(email || '').trim().toLowerCase()
  const pass = String(password || '')

  if (!fName || fName.length > 40) return { field: 'firstName', message: 'Enter your first name (up to 40 characters).' }
  if (!lName || lName.length > 40) return { field: 'lastName', message: 'Enter your last name (up to 40 characters).' }
  if (!em || em.length > 80 || !EMAIL_RE.test(em)) return { field: 'email', message: 'Enter a valid email address.' }
  const passProblem = passwordProblem(pass, em)
  if (passProblem) return { field: 'password', message: passProblem }

  return {
    success: true,
    data: {
      firstName: fName,
      lastName: lName,
      email: em,
      password: pass
    }
  }
}
