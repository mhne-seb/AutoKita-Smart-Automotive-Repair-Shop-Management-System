'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { BOOKING_TIMES, formatSlotRange } from '@/lib/bookingSlotsShared'
import { ShopHours, hoursForWeekday } from '@/lib/bookingTiming'
import {
  startOfToday,
  isSameDay,
  isPastSlot,
  isOccupiedSlot,
  dayStatus,
} from '@/lib/visitSlots'
import { cn } from '@/lib/utils'

export interface VisitDatePickerProps {
  date: Date
  time: string
  dateChosen: boolean
  shopHours: ShopHours
  dateHeading: string
  timeHeading: string
  onChangeDate: (d: Date) => void
  onChangeTime: (t: string) => void
  onAvailableSlots?: (slots: string[]) => void
  onBusyDatesLoaded?: (
    busyDates: string[],
    earliestAvailableByDate: Record<string, { availableFrom: string; mechanicName: string }>
  ) => void
}

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function VisitDatePicker({
  date,
  time,
  dateChosen,
  shopHours,
  dateHeading,
  timeHeading,
  onChangeDate,
  onChangeTime,
  onAvailableSlots,
  onBusyDatesLoaded,
}: VisitDatePickerProps) {
  const [occupiedByDate, setOccupiedByDate] = useState<Record<string, string[]>>({})
  const [busyDates, setBusyDates] = useState<string[]>([])
  const [earliestAvailableByDate, setEarliestAvailableByDate] = useState<
    Record<string, { availableFrom: string; mechanicName: string }>
  >({})
  const today = useMemo(() => startOfToday(), [])

  const [currentMonth, setCurrentMonth] = useState(() => {
    const initial = dateChosen ? date : today
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })

  useEffect(() => {
    fetch('/api/customer/booking/occupied-slots')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.occupiedByDate) setOccupiedByDate(data.occupiedByDate)
          if (Array.isArray(data.busyDates)) setBusyDates(data.busyDates)
          if (data.earliestAvailableByDate) setEarliestAvailableByDate(data.earliestAvailableByDate)
          if (onBusyDatesLoaded) {
            onBusyDatesLoaded(data.busyDates || [], data.earliestAvailableByDate || {})
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load occupied slots:', err)
      })
  }, [onBusyDatesLoaded])

  useEffect(() => {
    if (!onAvailableSlots) return
    if (!dateChosen) {
      onAvailableSlots([])
      return
    }
    const free = BOOKING_TIMES.filter((t) => !isPastSlot(date, t) && !isOccupiedSlot(date, t, occupiedByDate))
    onAvailableSlots(free)
  }, [date, dateChosen, occupiedByDate, onAvailableSlots])

  const earliestAvailableText = useMemo(() => {
    for (let i = 0; i < 60; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const weekday = d.getDay()
      if (hoursForWeekday(shopHours, weekday) === null) continue
      const status = dayStatus(d, BOOKING_TIMES, occupiedByDate, busyDates)
      if (status === 'open' || status === 'busy') {
        return d.toLocaleDateString('en-PH', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      }
    }
    return null
  }, [today, shopHours, occupiedByDate])

  const minMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const maxMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth() + 3, 1), [today])

  const canPrevMonth = currentMonth.getTime() > minMonth.getTime()
  const canNextMonth = currentMonth.getTime() < maxMonth.getTime()

  const prevMonth = () => {
    if (!canPrevMonth) return
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    if (!canNextMonth) return
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDayOfWeek = new Date(year, month, 1).getDay()
    const days: Date[] = []
    const start = new Date(year, month, 1 - firstDayOfWeek)
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return days
  }, [currentMonth])

  const allBookedOrPast = useMemo(() => {
    if (!dateChosen) return false
    return BOOKING_TIMES.every((t) => isPastSlot(date, t) || isOccupiedSlot(date, t, occupiedByDate))
  }, [date, dateChosen, occupiedByDate])

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left Column: Date */}
      <div>
        <h4 className="text-sm font-semibold text-foreground">{dateHeading}</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {earliestAvailableText
            ? `Earliest available: ${earliestAvailableText}`
            : 'No available date in the next 2 months.'}
        </p>

        {/* Month Calendar */}
        <div className="mt-3 rounded-xl border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-foreground">
              {currentMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                disabled={!canPrevMonth}
                aria-label="Previous month"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                disabled={!canNextMonth}
                aria-label="Next month"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground pb-1">
            {WEEKDAY_NAMES.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* 6-week Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cellDate) => {
              const isCurrentMonth = cellDate.getMonth() === currentMonth.getMonth()
              const isPast = cellDate < today && !isSameDay(cellDate, today)
              const isClosed = hoursForWeekday(shopHours, cellDate.getDay()) === null
              const status = isCurrentMonth && !isPast && !isClosed ? dayStatus(cellDate, BOOKING_TIMES, occupiedByDate, busyDates) : null
              const isFull = status === 'full'
              const isBusy = status === 'busy'
              const isOpen = status === 'open'
              const isSelected = dateChosen && isSameDay(cellDate, date)

              let labelSuffix = ', unavailable'
              if (isClosed) labelSuffix = ', closed'
              else if (isFull) labelSuffix = ', fully booked'
              else if (isBusy) labelSuffix = ', mechanics busy (work starts later)'
              else if (isSelected) labelSuffix = ', selected'
              else if (isOpen) labelSuffix = ', available'

              const ariaLabel = `${cellDate.toLocaleDateString('en-PH', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}${labelSuffix}`

              if (!isCurrentMonth || isPast) {
                return (
                  <button
                    key={cellDate.toISOString()}
                    type="button"
                    disabled
                    aria-label={ariaLabel}
                    className="flex h-8 w-full items-center justify-center rounded text-xs text-muted-foreground/30 cursor-not-allowed"
                  >
                    {cellDate.getDate()}
                  </button>
                )
              }

              if (isClosed) {
                return (
                  <button
                    key={cellDate.toISOString()}
                    type="button"
                    disabled
                    title="Closed"
                    aria-label={ariaLabel}
                    className="flex h-8 w-full items-center justify-center rounded text-xs text-muted-foreground/40 cursor-not-allowed"
                  >
                    {cellDate.getDate()}
                  </button>
                )
              }

              if (isFull) {
                return (
                  <button
                    key={cellDate.toISOString()}
                    type="button"
                    disabled
                    title="Fully booked"
                    aria-label={ariaLabel}
                    className="flex h-8 w-full items-center justify-center rounded border border-rose-200 bg-rose-50 text-xs font-bold text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 cursor-not-allowed"
                  >
                    {cellDate.getDate()}
                  </button>
                )
              }

              return (
                <button
                  key={cellDate.toISOString()}
                  type="button"
                  onClick={() => onChangeDate(cellDate)}
                  aria-label={ariaLabel}
                  title={isBusy ? 'All mechanics full with other job orders — work will start when mechanic is available' : 'Available'}
                  className={cn(
                    'flex h-8 w-full items-center justify-center rounded text-xs font-bold transition-colors cursor-pointer',
                    isSelected
                      ? isBusy
                        ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                        : 'bg-brand text-brand-foreground shadow-sm'
                      : isBusy
                      ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400'
                  )}
                >
                  {cellDate.getDate()}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 border-t pt-2 text-[11px] flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground font-medium">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-muted-foreground font-medium">Mechanics busy (Starts later)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span className="text-muted-foreground font-medium">Fully booked</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Time */}
      <div>
        <h4 className="text-sm font-semibold text-foreground">{timeHeading}</h4>

        {!dateChosen ? (
          <p className="mt-2 text-xs text-muted-foreground">Pick a date first.</p>
        ) : (
          <>
            {allBookedOrPast && (
              <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                All times for this date are taken. Please pick another date.
              </div>
            )}

            <div
              role="radiogroup"
              aria-label={timeHeading}
              className="mt-3 max-w-[17rem] space-y-1"
            >
              {BOOKING_TIMES.map((t) => {
                const past = isPastSlot(date, t)
                const occupied = isOccupiedSlot(date, t, occupiedByDate)
                const disabled = past || occupied
                const isSelected = time === t

                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={disabled}
                    onClick={() => !disabled && onChangeTime(t)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 rounded-md border px-3 py-1.5 text-[13px] transition-colors text-left',
                      occupied
                        ? 'cursor-not-allowed border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
                        : disabled
                        ? 'cursor-not-allowed border-dashed border-border/60 bg-muted/20 text-muted-foreground/50'
                        : isSelected
                        ? 'cursor-pointer border-brand bg-brand-soft/40 ring-1 ring-brand text-foreground font-medium'
                        : 'cursor-pointer border-border hover:bg-accent/50 text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                          occupied ? 'border-rose-300 opacity-60 dark:border-rose-800' : isSelected ? 'border-brand' : 'border-muted-foreground/40'
                        )}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-full bg-brand" />}
                      </span>
                      <span className={cn(occupied ? 'line-through' : '')}>{formatSlotRange(t)}</span>
                    </div>
                    <div>
                      {occupied ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          <Lock className="h-3 w-3" aria-hidden="true" /> Taken
                        </span>
                      ) : past ? (
                        <span className="text-[11px] text-muted-foreground/60">Passed</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Available</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
