// One-hour arrival windows. Each value is the START of its window ("08:00 AM" = 8 - 9 AM); that start time
// is what gets saved on the booking. One booking per window.
export const BOOKING_TIMES = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
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

function hourParts(h24: number): { n: number; ap: 'AM' | 'PM' } {
  const h = ((h24 % 24) + 24) % 24
  return { n: h % 12 === 0 ? 12 : h % 12, ap: h >= 12 ? 'PM' : 'AM' }
}

/** One-hour window starting at this hour (0-23): 8 -> "8 - 9 AM", 11 -> "11 AM - 12 PM", 12 -> "12 - 1 PM". */
export function formatHourRange(startHour: number): string {
  const s = hourParts(startHour)
  const e = hourParts(startHour + 1)
  return s.ap === e.ap ? `${s.n} - ${e.n} ${e.ap}` : `${s.n} ${s.ap} - ${e.n} ${e.ap}`
}

/** A slot value like "08:00 AM" -> "8 - 9 AM". A time that is not on the hour ("09:30 AM") shows its hour's window. */
export function formatSlotRange(time: string): string {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return time
  let h = parseInt(match[1], 10)
  const ap = match[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return formatHourRange(h)
}

const MANILA_HOUR = new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TIMEZONE, hour: 'numeric', hourCycle: 'h23' })

// A booking time can arrive as a Date, an ISO string, a timestamptz text ("2026-10-20 08:00:00+08") or naive
// Manila text ("2026-10-20 08:00:00"). Returns the Manila hour and a Date that formats to the right day.
function resolveVisit(value: string | Date | null | undefined): { day: Date; hour: number; zone: string } | null {
  if (!value) return null
  if (typeof value === 'string') {
    const naive = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
    if (naive) {
      return { day: new Date(Date.UTC(+naive[1], +naive[2] - 1, +naive[3], 12)), hour: +naive[4], zone: 'UTC' }
    }
  }
  const d =
    typeof value === 'string' ? new Date(value.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')) : value
  if (Number.isNaN(d.getTime())) return null
  return { day: d, hour: parseInt(MANILA_HOUR.format(d), 10) % 24, zone: MANILA_TIMEZONE }
}

/** "8 - 9 AM" for a booking time, or null when it cannot be read. */
export function formatVisitRange(value: string | Date | null | undefined): string | null {
  const v = resolveVisit(value)
  return v ? formatHourRange(v.hour) : null
}

/** "Oct 20, 2026, 8 - 9 AM" for a booking time, or null when it cannot be read. */
export function formatVisitWindow(value: string | Date | null | undefined): string | null {
  const v = resolveVisit(value)
  if (!v) return null
  const date = v.day.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: v.zone })
  return `${date}, ${formatHourRange(v.hour)}`
}
