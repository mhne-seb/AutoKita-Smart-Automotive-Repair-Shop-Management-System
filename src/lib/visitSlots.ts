// Helpers for the visit date picker (calendar + time list). The old TimeslotPicker keeps its own copies.

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function toDateValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function parseTime(t: string): { h: number; m: number } {
  const match = t.match(/(\d+):(\d+)\s?(AM|PM)/i)
  if (!match) return { h: 0, m: 0 }
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ap = match[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m }
}

export function normalizeTimeSlot(t: string): string {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return t.trim()
  const h = parseInt(match[1], 10)
  const m = match[2].padStart(2, '0')
  const ap = (match[3] || 'AM').toUpperCase()
  return `${String(h).padStart(2, '0')}:${m} ${ap}`
}

export function isPastSlot(date: Date, time: string): boolean {
  if (!isSameDay(date, new Date())) return false
  const { h, m } = parseTime(time)
  const slot = new Date(date)
  slot.setHours(h, m, 0, 0)
  return slot.getTime() < Date.now()
}

export function isOccupiedSlot(date: Date, time: string, occupiedByDate: Record<string, string[]>): boolean {
  const taken = occupiedByDate[toDateValue(date)] || []
  if (taken.length === 0) return false
  return taken.map(normalizeTimeSlot).includes(normalizeTimeSlot(time))
}

// 'open' = at least one free time, 'full' = every time is booked or passed.
export function dayStatus(date: Date, times: string[], occupiedByDate: Record<string, string[]>): 'open' | 'full' {
  const anyFree = times.some((t) => !isPastSlot(date, t) && !isOccupiedSlot(date, t, occupiedByDate))
  return anyFree ? 'open' : 'full'
}
