'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { scheduleTask } from '@/controllers/serviceProgressController'
import type { Suggestion } from '@/lib/autoSchedule'

interface AutoScheduleData {
  success: boolean
  suggestions: Suggestion[]
  promisedDate: string | null
  alreadyPromised: string | null
  earlier: Array<{ jobOrderId: number; plate: string; arrived: string }>
  nothingToSchedule: boolean
}

function parseIsoParts(iso: string) {
  const [datePart, timePart = '00:00:00'] = iso.replace(' ', 'T').split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return { y, m, d, hh: hh || 0, mm: mm || 0 }
}

function formatTime(hh: number, mm: number) {
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 || 12
  const mStr = String(mm).padStart(2, '0')
  return `${h12}:${mStr} ${ampm}`
}

function formatDateLabel(y: number, m: number, d: number) {
  const dateObj = new Date(Date.UTC(y, m - 1, d))
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatTaskSchedule(startIso: string, endIso: string) {
  const s = parseIsoParts(startIso)
  const e = parseIsoParts(endIso)
  const startDate = formatDateLabel(s.y, s.m, s.d)
  const startTime = formatTime(s.hh, s.mm)
  const endTime = formatTime(e.hh, e.mm)
  if (s.y === e.y && s.m === e.m && s.d === e.d) {
    return `${startDate}, ${startTime} to ${endTime}`
  }
  const endDate = formatDateLabel(e.y, e.m, e.d)
  return `${startDate}, ${startTime} to ${endDate}, ${endTime}`
}

function formatPromisedDate(iso: string) {
  const p = parseIsoParts(iso)
  const dateLabel = formatDateLabel(p.y, p.m, p.d)
  const timeLabel = formatTime(p.hh, p.mm)
  return `${dateLabel}, ${timeLabel}`
}

export function AutoScheduleModal({
  jobOrderId,
  onClose,
  onApplied,
}: {
  jobOrderId: string
  onClose: () => void
  onApplied: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AutoScheduleData | null>(null)
  const [applying, setApplying] = useState(false)

  const loadSuggestion = () => {
    setLoading(true)
    setError(null)
    fetch(`/api/job-orders/${jobOrderId}/progress/suggest-schedule`)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((json) => {
            throw new Error(json.message || 'Could not load schedule suggestions.')
          })
        }
        return res.json()
      })
      .then((json: AutoScheduleData) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load schedule suggestions.')
        setLoading(false)
      })
  }

  useEffect(() => {
    loadSuggestion()
  }, [jobOrderId])

  const handleApply = async () => {
    if (!data) return
    const okSuggestions = data.suggestions.filter(
      (s): s is Extract<Suggestion, { ok: true }> => s.ok,
    )
    if (okSuggestions.length === 0) return

    setApplying(true)

    // Save each suggestion sequentially
    let savedCount = 0
    for (let i = 0; i < okSuggestions.length; i++) {
      const s = okSuggestions[i]
      const res = await scheduleTask(
        jobOrderId,
        String(s.taskId),
        s.start,
        'pending',
        s.mechanicId,
      )

      if (!res.ok) {
        setApplying(false)
        const msg = res.message || 'Could not schedule task.'
        if (savedCount > 0) {
          toast.error(`Saved ${savedCount} of ${okSuggestions.length} tasks. ${msg}`)
        } else {
          toast.error(msg)
        }
        return
      }
      savedCount++
    }

    // Save promised date if present and not already set
    if (data.promisedDate && !data.alreadyPromised) {
      try {
        await fetch(`/api/job-orders/${jobOrderId}/progress/promised-date`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promisedDate: data.promisedDate }),
        })
      } catch (err) {
        console.error('Failed to set promised date:', err)
      }
    }

    setApplying(false)
    toast.success('Schedule applied.')
    onApplied()
  }

  const okCount = data?.suggestions.filter((s) => s.ok).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Auto-schedule</h2>
              <p className="text-xs text-slate-400">Proposed schedule based on mechanic availability</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Loader2 size={24} className="animate-spin text-indigo-600" />
            <p className="text-xs">Finding best schedule...</p>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-4 py-4 text-center">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
            <button
              type="button"
              onClick={loadSuggestion}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && data.nothingToSchedule && (
          <div className="space-y-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-600">Every task is already scheduled.</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !error && data && !data.nothingToSchedule && (
          <div className="space-y-4">
            {/* Earlier cars warning */}
            {data.earlier.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <p>
                  {data.earlier.length} car{data.earlier.length === 1 ? '' : 's'} arrived earlier and{' '}
                  {data.earlier.length === 1 ? 'is' : 'are'} not scheduled yet:{' '}
                  {data.earlier.map((e) => `JO-${e.jobOrderId} (${e.plate})`).join(', ')}. Schedule
                  them first to keep first come, first served.
                </p>
              </div>
            )}

            {/* Task list */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/30">
              {data.suggestions.map((s) => (
                <div key={s.taskId} className="p-3 text-sm space-y-1">
                  <p className="font-semibold text-slate-800">{s.title}</p>
                  {s.ok ? (
                    <p className="text-xs text-slate-600">
                      {s.mechanicName}, {formatTaskSchedule(s.start, s.end)}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 font-medium">{s.reason}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Promised date line */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-slate-500">
                <Clock size={13} /> Target Completion
              </span>
              <span className="font-semibold text-slate-800">
                {data.alreadyPromised
                  ? `Already promised: ${formatPromisedDate(data.alreadyPromised)}`
                  : data.promisedDate
                  ? `Ready by ${formatPromisedDate(data.promisedDate)}`
                  : 'Ready-by date will be set after the part arrives.'}
              </span>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={applying}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || okCount === 0}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {applying ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Applying...
                  </>
                ) : (
                  <>
                    <Check size={13} /> Apply schedule
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
