export const BOOKING_TIMES = [
  "08:00 AM",
  "09:30 AM",
  "10:30 AM",
  "01:00 PM",
  "02:30 PM",
  "04:00 PM",
]

export const MANILA_TIMEZONE = 'Asia/Manila'

/**
 * Normalizes time string to "hh:mm AM/PM" (2-digit hour with leading zero, uppercase AM/PM).
 * e.g., "8:00 am" -> "08:00 AM", "10:30 pm" -> "10:30 PM"
 */
export function normalizeTimeSlot(t: string): string {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return t.trim()
  let h = parseInt(match[1], 10)
  const m = match[2].padStart(2, '0')
  const ap = (match[3] || 'AM').toUpperCase()
  return `${String(h).padStart(2, '0')}:${m} ${ap}`
}

/**
 * Formats a Date/timestamp into Manila date string "YYYY-MM-DD"
 */
export function formatManilaDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-CA', { timeZone: MANILA_TIMEZONE })
}

/**
 * Formats a Date/timestamp into Manila time string "hh:mm AM/PM"
 */
export function formatManilaTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: MANILA_TIMEZONE,
  })
}

/**
 * Converts a Manila date string (YYYY-MM-DD) and 12-hour/24-hour time string
 * into an accurate UTC ISO string for Manila wall-clock time (+08:00).
 */
export function toManilaIso(dateStr: string, time12or24: string): string {
  const match = time12or24.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) {
    return new Date(`${dateStr}T08:00:00+08:00`).toISOString()
  }
  let h = parseInt(match[1], 10)
  const m = match[2].padStart(2, '0')
  const ap = match[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  const hh = String(h).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${m}:00+08:00`).toISOString()
}
