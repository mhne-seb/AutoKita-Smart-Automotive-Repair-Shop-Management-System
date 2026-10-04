'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { BOOKING_TIMES } from '@/lib/bookingSlotsShared'

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(base: Date, n: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

function isToday(d: Date) {
  return isSameDay(d, new Date())
}

function parseTime(t: string) {
  const match = t.match(/(\d+):(\d+)\s?(AM|PM)/i)
  if (!match) return { h: 0, m: 0 }
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  const ap = match[3].toUpperCase()
  if (ap === 'PM' && h !== 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  return { h, m }
}

function isPastSlot(date: Date, time: string) {
  if (!isToday(date)) return false
  const { h, m } = parseTime(time)
  const slot = new Date(date)
  slot.setHours(h, m, 0, 0)
  return slot.getTime() < Date.now()
}

function normalizeTimeSlot(t: string): string {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return t.trim()
  let h = parseInt(match[1], 10)
  const m = match[2].padStart(2, '0')
  const ap = (match[3] || 'AM').toUpperCase()
  return `${String(h).padStart(2, '0')}:${m} ${ap}`
}

function isOccupiedSlot(date: Date, time: string, occupiedByDate: Record<string, string[]> = {}) {
  if (!date || !time) return false
  const dateKey = toDateValue(date)
  const occupiedTimes = occupiedByDate[dateKey] || []
  if (occupiedTimes.length === 0) return false

  const normalizedTarget = normalizeTimeSlot(time)
  if (occupiedTimes.map(normalizeTimeSlot).includes(normalizedTarget)) {
    return true
  }
  return false
}

function formatDayLabel(d: Date) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return {
    d: days[d.getDay()],
    n: d.getDate(),
    m: months[d.getMonth()],
  }
}

function toDateValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

function fromDateValue(v: string) {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export interface TimeslotPickerProps {
  date: Date
  time: string
  onChangeDate: (d: Date) => void
  onChangeTime: (t: string) => void
}

export function TimeslotPicker({ date, time, onChangeDate, onChangeTime }: TimeslotPickerProps) {
  const [occupiedByDate, setOccupiedByDate] = useState<Record<string, string[]>>({})
  
  useEffect(() => {
    fetch('/api/customer/booking/occupied-slots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.occupiedByDate) {
          setOccupiedByDate(data.occupiedByDate)
        }
      })
      .catch((err) => console.error('Failed to load slots:', err))
  }, [])

  // Auto-select next available if current is invalid after load
  useEffect(() => {
    if (isOccupiedSlot(date, time, occupiedByDate) || isPastSlot(date, time)) {
      const firstAvailable = BOOKING_TIMES.find(
        (t) => !isPastSlot(date, t) && !isOccupiedSlot(date, t, occupiedByDate)
      )
      if (firstAvailable) {
        onChangeTime(firstAvailable)
      }
    }
  }, [date, time, occupiedByDate, onChangeTime])

  const visibleDays = useMemo(() => {
    let base = startOfToday()
    // if selected date is in the past, push base back (shouldn't happen with the date picker constraint, but just in case)
    if (date < base) base = date
    const d: Date[] = []
    let curr = new Date(base)
    // show a bit before and after if date is far? No, just show 30 days from today
    for (let i = 0; i < 30; i++) {
      d.push(new Date(curr))
      curr = addDays(curr, 1)
    }
    // ensure selected date is in the list
    if (!d.find((x) => isSameDay(x, date))) {
      d.unshift(date)
      d.sort((a, b) => a.getTime() - b.getTime())
    }
    return d
  }, [date])

  const allBooked = BOOKING_TIMES.every((t) => isPastSlot(date, t) || isOccupiedSlot(date, t, occupiedByDate))

  return (
    <div className="w-full">
      {/* Pick any date */}
      <div className="mb-3">
        <label className="text-[10px] font-semibold uppercase text-muted-foreground">
          Pick a date
        </label>
        <input
          type="date"
          min={toDateValue(startOfToday())}
          value={toDateValue(date)}
          onChange={(e) => e.target.value && onChangeDate(fromDateValue(e.target.value))}
          className="mt-1.5 block rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </div>

      {/* Quick day strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {visibleDays.map((day) => {
          const sel = isSameDay(day, date)
          const today = isToday(day)
          const label = formatDayLabel(day)
          const dayKey = toDateValue(day)
          const dayOccupied = occupiedByDate[dayKey] || []
          const isFull = BOOKING_TIMES.every((t) => isPastSlot(day, t) || isOccupiedSlot(day, t, occupiedByDate))
          const hasOccupied = dayOccupied.length > 0
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onChangeDate(day)}
              className={`relative w-[4.5rem] flex-shrink-0 cursor-pointer rounded-lg border p-3 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 ${
                sel ? 'border-brand bg-brand text-brand-foreground shadow-lg' : 'hover:bg-accent'
              }`}
            >
              {today && (
                <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${sel ? 'bg-white' : 'bg-brand'}`} />
              )}
              <div className={`text-[10px] font-semibold uppercase ${sel ? 'text-white/80' : 'text-muted-foreground'}`}>
                {today ? 'TODAY' : label.d}
              </div>
              <div className="mt-1 text-2xl font-bold">{label.n}</div>
              <div className={`text-[10px] ${sel ? 'text-white/80' : 'text-muted-foreground'}`}>{label.m}</div>
              {isFull ? (
                <span className={`mt-1 block text-[9px] font-bold uppercase tracking-wider ${sel ? 'text-rose-200' : 'text-rose-500'}`}>
                  Full
                </span>
              ) : hasOccupied ? (
                <span className={`mt-1 block text-[9px] font-medium ${sel ? 'text-white/70' : 'text-muted-foreground'}`}>
                  {BOOKING_TIMES.filter((t) => !isPastSlot(day, t) && !isOccupiedSlot(day, t, occupiedByDate)).length} left
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Preset time slots */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BOOKING_TIMES.map((t) => {
          const sel = time === t
          const past = isPastSlot(date, t)
          const occupied = isOccupiedSlot(date, t, occupiedByDate)
          const disabled = past || occupied
          return (
            <button
              key={t}
              type="button"
              onClick={() => !disabled && onChangeTime(t)}
              disabled={disabled}
              title={
                past
                  ? 'This time has already passed for today'
                  : occupied
                  ? 'This time slot is already booked'
                  : undefined
              }
              className={`relative flex flex-col items-center justify-center rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                disabled
                  ? occupied
                    ? 'cursor-not-allowed border-rose-200 bg-rose-50/70 text-rose-400 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-500'
                    : 'cursor-not-allowed border-dashed text-muted-foreground/40'
                  : sel
                  ? 'border-brand bg-brand text-brand-foreground shadow-sm cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
                  : 'hover:border-brand hover:bg-brand-soft cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              <span className={occupied ? 'line-through opacity-75' : ''}>{t}</span>
              {occupied && (
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Booked
                </span>
              )}
            </button>
          )
        })}
      </div>

      {allBooked && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>All preset time slots for this date are fully booked or have passed. Please select another date.</span>
        </div>
      )}
    </div>
  )
}
