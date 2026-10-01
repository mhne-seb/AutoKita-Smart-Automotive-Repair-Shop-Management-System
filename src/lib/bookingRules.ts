// bookingRules.ts — the input rules every booking route shares (the customer's
// online booking and the admin's walk-in "New Ticket"), so the two can never
// drift apart. Server-side only checks; the forms repeat them for convenience.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX (spaces and dashes are stripped first).
export const PHONE_RE = /^(\+?63|0)9\d{9}$/

export const MAX_NAME = 50
export const MAX_MODEL = 40
export const MAX_EMAIL = 100
export const MAX_MILEAGE = 1_000_000

/** Mobile number without spaces or dashes. */
export function cleanPhone(v: unknown): string {
  return String(v ?? '').replace(/[\s-]/g, '')
}

/** The latest year a vehicle can have (next year's models are already on sale). */
export function maxVehicleYear(): number {
  return new Date().getFullYear() + 1
}

/**
 * Reads a mileage typed by a person. "45000", "45,000" and "45,000 km" all mean 45000.
 * Returns null when it is empty, not a plain non-negative number, or out of range.
 */
export function parseMileage(v: unknown): number | null {
  const t = String(v ?? '').trim().replace(/km$/i, '').replace(/[,\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= MAX_MILEAGE ? n : null
}

/** "Juan  dela Cruz" -> { first: "Juan", last: "dela Cruz" }; null when there is no last name. */
export function splitFullName(v: unknown): { first: string; last: string } | null {
  const parts = String(v ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { first: parts[0], last: parts.slice(1).join(' ') }
}
