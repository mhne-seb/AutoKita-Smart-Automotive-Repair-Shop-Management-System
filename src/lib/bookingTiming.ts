export const DEFAULT_OPEN_HOUR = 8       // 08:00
export const DEFAULT_CLOSE_HOUR = 17     // 17:00
export const MARGIN_RATIO = 0.15
export const MARGIN_MIN_HOURS = 0.5

export type ShopHours = Record<string, string> | null | undefined

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function parseTimeStr(str: string): number {
  if (typeof str !== 'string') return NaN
  const m = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i)
  if (!m) return NaN
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (min < 0 || min >= 60) return NaN
  const meridiem = m[3]?.toLowerCase()
  if (meridiem) {
    if (h < 1 || h > 12) return NaN
    if (meridiem === 'pm' && h !== 12) h += 12
    if (meridiem === 'am' && h === 12) h = 0
  } else {
    if (h < 0 || h > 24) return NaN
  }
  return h + min / 60
}

// "04:00 PM" / "4:00 PM" / "16:00" -> 16 (decimal hours). Returns NaN when unreadable.
export function slotStartHour(slot: string): number {
  return parseTimeStr(slot)
}

// Opening and closing hour (decimal, e.g. 16.5) for a weekday index (0 = Sunday ... 6 = Saturday).
// Returns null when the shop is closed that day. Missing or unreadable data returns the defaults.
export function hoursForWeekday(shopHours: ShopHours, weekday: number): { open: number; close: number } | null {
  const dayName = WEEKDAYS[weekday]
  if (!dayName || !shopHours || typeof shopHours !== 'object') {
    return { open: DEFAULT_OPEN_HOUR, close: DEFAULT_CLOSE_HOUR }
  }
  const raw = shopHours[dayName]
  if (typeof raw !== 'string') {
    return { open: DEFAULT_OPEN_HOUR, close: DEFAULT_CLOSE_HOUR }
  }
  const val = raw.trim().toLowerCase()
  if (val === 'closed') {
    return null
  }
  const parts = val.split('-').map((s) => s.trim())
  if (parts.length === 2) {
    const openH = parseTimeStr(parts[0])
    const closeH = parseTimeStr(parts[1])
    if (!Number.isNaN(openH) && !Number.isNaN(closeH) && closeH > openH) {
      return { open: openH, close: closeH }
    }
  }
  return { open: DEFAULT_OPEN_HOUR, close: DEFAULT_CLOSE_HOUR }
}

// Total hours plus the safety margin: total + max(MARGIN_MIN_HOURS, MARGIN_RATIO * total), rounded up to 0.25.
export function withMargin(totalHours: number): number {
  if (typeof totalHours !== 'number' || !Number.isFinite(totalHours) || totalHours <= 0) {
    return 0
  }
  const raw = totalHours + Math.max(MARGIN_MIN_HOURS, MARGIN_RATIO * totalHours)
  return Math.ceil(raw * 4) / 4
}
