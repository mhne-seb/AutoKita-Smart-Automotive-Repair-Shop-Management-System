'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  WandSparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { scheduleTask } from '@/controllers/serviceProgressController'
import {
  suggestSchedule,
  layoutJob,
  parseNaiveTimestamp,
  sortLongestFirst,
  sortMaintenanceShortFirst,
  type Interval,
  type MechanicInput,
  type Placement,
  type Suggestion,
} from '@/lib/autoSchedule'
import { hoursForWeekday } from '@/lib/bookingTiming'
import { formatHours } from '@/lib/formatHours'
import { MAX_MECHANICS_ON_CAR } from '@/data/shopPolicy'

interface PlanningMechanic {
  id: number
  name: string
  busy: Array<{ start: string; end: string }>
}

interface PlanningCarBusy {
  start: string
  end: string
}

interface PlanningTask {
  id: number
  title: string
  hours: number
  blockedBy: string | null
  partExpected: string | null
  serviceType?: string | null
}

interface PlanningData {
  nowIso: string
  shopHours: Record<string, string>
  preferredMechanicId: number | null
  mechanics: PlanningMechanic[]
  carBusy: PlanningCarBusy[]
  tasks: PlanningTask[]
}

interface ScheduleResponse {
  success: boolean
  suggestions: Suggestion[]
  promisedDate: string | null
  alreadyPromised: string | null
  earlier: Array<{ jobOrderId: number; plate: string; arrived: string }>
  nothingToSchedule: boolean
  planning: PlanningData
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

function formatDateWithYear(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatPlacementLines(startIso: string, endIso: string) {
  const s = parseIsoParts(startIso)
  const e = parseIsoParts(endIso)
  const dateLine = formatDateWithYear(s.y, s.m, s.d)
  const sameDay = s.y === e.y && s.m === e.m && s.d === e.d
  const timeLine = sameDay
    ? `${formatTime(s.hh, s.mm)} – ${formatTime(e.hh, e.mm)}`
    : `${formatTime(s.hh, s.mm)} – ${formatDateLabel(e.y, e.m, e.d)}, ${formatTime(e.hh, e.mm)}`
  return { dateLine, timeLine }
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


function serviceTypeLabel(value: string | null | undefined) {
  if (value === 'maintenance') return 'Maintenance'
  if (value === 'repair') return 'Repair'
  if (value === 'diagnostics') return 'Diagnostics'
  return null
}

export function ScheduleJobModal({
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
  const [data, setData] = useState<ScheduleResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const [start, setStart] = useState<{ date: string; time: string }>({
    date: '',
    time: '',
  })
  const [assignments, setAssignments] = useState<Record<number, number | null>>({})
  const [pinned, setPinned] = useState<Record<number, { date: string; time: string }>>({})
  const [pool, setPool] = useState<number[]>([])
  const [share, setShare] = useState(false)
  const [order, setOrder] = useState<number[]>([])
  const [dragId, setDragId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [dragReadyId, setDragReadyId] = useState<number | null>(null)

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
      .then((json: ScheduleResponse) => {
        setData(json)

        // Set initial start
        const firstOk = json.suggestions.find(
          (s): s is Extract<Suggestion, { ok: true }> => s.ok,
        )
        if (firstOk) {
          setStart({
            date: firstOk.start.slice(0, 10),
            time: firstOk.start.slice(11, 16),
          })
        } else {
          // Next opening time from now
          const nowMs = parseNaiveTimestamp(json.planning.nowIso)
          let foundStart: { date: string; time: string } | null = null
          for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const candidateMs = nowMs + dayOffset * 24 * 3600 * 1000
            const d = new Date(candidateMs)
            const weekday = d.getUTCDay()
            const dayHours = hoursForWeekday(json.planning.shopHours, weekday)
            if (dayHours) {
              const dayOpenH = Math.floor(dayHours.open)
              const dayOpenM = Math.round((dayHours.open % 1) * 60)
              const dayOpenTime = `${String(dayOpenH).padStart(2, '0')}:${String(dayOpenM).padStart(2, '0')}`
              const y = d.getUTCFullYear()
              const m = String(d.getUTCMonth() + 1).padStart(2, '0')
              const dayStr = String(d.getUTCDate()).padStart(2, '0')
              const dateStr = `${y}-${m}-${dayStr}`
              const openMs = Date.UTC(y, d.getUTCMonth(), d.getUTCDate(), dayOpenH, dayOpenM, 0)
              if (dayOffset > 0 || nowMs <= openMs) {
                foundStart = { date: dateStr, time: dayOpenTime }
                break
              }
            }
          }

          if (foundStart) {
            setStart(foundStart)
          } else {
            const d = new Date(nowMs)
            const y = d.getUTCFullYear()
            const m = String(d.getUTCMonth() + 1).padStart(2, '0')
            const dayStr = String(d.getUTCDate()).padStart(2, '0')
            const fallbackHours = hoursForWeekday(null, 1)
            const openH = fallbackHours ? Math.floor(fallbackHours.open) : 8
            const openM = fallbackHours ? Math.round((fallbackHours.open % 1) * 60) : 0
            const openTime = `${String(openH).padStart(2, '0')}:${String(openM).padStart(2, '0')}`
            setStart({ date: `${y}-${m}-${dayStr}`, time: openTime })
          }
        }

        // Set initial assignments
        const initialAssignments: Record<number, number | null> = {}
        for (const t of json.planning.tasks) {
          const s = json.suggestions.find((sug) => sug.taskId === t.id)
          initialAssignments[t.id] = s && s.ok ? s.mechanicId : null
        }
        setAssignments(initialAssignments)
        setPinned({})
        setOrder(json.planning.tasks.map((t) => t.id))

        // Initial pool and share
        const okMechs = Array.from(
          new Set(
            json.suggestions
              .filter((s): s is Extract<Suggestion, { ok: true }> => s.ok)
              .map((s) => s.mechanicId),
          ),
        )
        let initialPool: number[] = okMechs
        if (initialPool.length === 0) {
          if (json.planning.preferredMechanicId != null) {
            initialPool = [json.planning.preferredMechanicId]
          } else if (json.planning.mechanics.length > 0) {
            initialPool = [json.planning.mechanics[0].id]
          } else {
            initialPool = []
          }
        }
        setPool(initialPool)
        setShare(false)

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

  const orderedTasks = useMemo(() => {
    if (!data?.planning) return []
    const byId = new Map(data.planning.tasks.map((t) => [t.id, t]))
    const inOrder = order.map((id) => byId.get(id)).filter((t): t is PlanningTask => Boolean(t))
    // Safety: never lose a task that is missing from order
    const missing = data.planning.tasks.filter((t) => !order.includes(t.id))
    return [...inOrder, ...missing]
  }, [data?.planning, order])

  // Single shared auto-schedule function
  const runAuto = (
    nextPool: number[],
    nextShare: boolean,
    nextOrder: number[] = order,
  ) => {
    if (!data?.planning || !start.date || !start.time) return
    const now = parseNaiveTimestamp(data.planning.nowIso)
    const startMs = parseNaiveTimestamp(`${start.date}T${start.time}:00`)
    const effectiveNow = Math.max(now, Number.isNaN(startMs) ? now : startMs)

    const mechanics: MechanicInput[] = data.planning.mechanics.map((m) => ({
      id: m.id,
      name: m.name,
      busy: m.busy.map((b) => ({
        start: parseNaiveTimestamp(b.start),
        end: parseNaiveTimestamp(b.end),
      })),
    }))

    const carBusy: Interval[] = data.planning.carBusy.map((b) => ({
      start: parseNaiveTimestamp(b.start),
      end: parseNaiveTimestamp(b.end),
    }))

    const byId = new Map(data.planning.tasks.map((t) => [t.id, t]))
    const tasksInOrder = nextOrder
      .map((id) => byId.get(id))
      .filter((t): t is PlanningTask => Boolean(t))

    const res = suggestSchedule({
      now: effectiveNow,
      hours: data.planning.shopHours,
      mechanics,
      carBusy,
      tasks: tasksInOrder,
      preferredMechanicId: data.planning.preferredMechanicId,
      poolIds: nextPool,
      share: nextShare,
    })

    const nextAssignments: Record<number, number | null> = {}
    for (const t of data.planning.tasks) {
      const s = res.suggestions.find((sug) => sug.taskId === t.id)
      nextAssignments[t.id] = s && s.ok ? s.mechanicId : null
    }
    setAssignments(nextAssignments)
    setPinned({})
  }

  const handleSuggestForMe = () => {
    runAuto(pool, share)
  }

  const handleRemoveFromPool = (mechId: number) => {
    if (pool.length <= 1) return
    const nextPool = pool.filter((id) => id !== mechId)
    const nextShare = nextPool.length < 2 ? false : share
    setPool(nextPool)
    if (nextPool.length < 2) setShare(false)
    runAuto(nextPool, nextShare)
  }

  const handleAddToPool = (mechId: number) => {
    if (pool.includes(mechId)) return
    const nextPool = [...pool, mechId]
    setPool(nextPool)
    runAuto(nextPool, share)
  }

  const handleToggleShare = (nextShare: boolean) => {
    if (nextShare) {
      const nextOrder = sortLongestFirst(data?.planning?.tasks || []).map((t) => t.id)
      setOrder(nextOrder)
      setShare(true)
      runAuto(pool, true, nextOrder)
    } else {
      setShare(false)
      runAuto(pool, false)
    }
  }

  const moveTask = (taskId: number, toIndex: number) => {
    setOrder((prev) => {
      const ids = orderedTasks.map((t) => t.id)
      const from = ids.indexOf(taskId)
      if (from === -1 || toIndex < 0 || toIndex >= ids.length || from === toIndex) return prev
      const next = [...ids]
      next.splice(from, 1)
      next.splice(toIndex, 0, taskId)
      return next
    })
    if (pinned[taskId] !== undefined) {
      setPinned((prev) => {
        const copy = { ...prev }
        delete copy[taskId]
        return copy
      })
      toast.info('Time now follows the order.')
    }
  }

  // Recompute preview with layoutJob
  const { placements, promisedDate } = useMemo(() => {
    if (!data?.planning || !start.date || !start.time) {
      return { placements: [], promisedDate: null }
    }
    const now = parseNaiveTimestamp(data.planning.nowIso)
    const startMs = parseNaiveTimestamp(`${start.date}T${start.time}:00`)

    const mechanics: MechanicInput[] = data.planning.mechanics.map((m) => ({
      id: m.id,
      name: m.name,
      busy: m.busy.map((b) => ({
        start: parseNaiveTimestamp(b.start),
        end: parseNaiveTimestamp(b.end),
      })),
    }))

    const carBusy: Interval[] = data.planning.carBusy.map((b) => ({
      start: parseNaiveTimestamp(b.start),
      end: parseNaiveTimestamp(b.end),
    }))

    const pinnedMs: Record<number, number> = {}
    for (const [taskIdStr, pin] of Object.entries(pinned)) {
      if (pin.date && pin.time) {
        const ms = parseNaiveTimestamp(`${pin.date}T${pin.time}:00`)
        if (!Number.isNaN(ms)) {
          pinnedMs[Number(taskIdStr)] = ms
        }
      }
    }

    return layoutJob({
      now,
      start: Number.isNaN(startMs) ? now : startMs,
      hours: data.planning.shopHours,
      mechanics,
      carBusy,
      tasks: orderedTasks,
      assignments,
      pinned: pinnedMs,
      share,
    })
  }, [data?.planning, start.date, start.time, assignments, pinned, share, orderedTasks])

  // Comparison plans (shared vs single mechanic)
  const { sharedReady, singleReady } = useMemo(() => {
    if (!data?.planning || !start.date || !start.time) {
      return { sharedReady: null, singleReady: null }
    }
    const now = parseNaiveTimestamp(data.planning.nowIso)
    const startMs = parseNaiveTimestamp(`${start.date}T${start.time}:00`)
    const effectiveNow = Math.max(now, Number.isNaN(startMs) ? now : startMs)

    const mechanics: MechanicInput[] = data.planning.mechanics.map((m) => ({
      id: m.id,
      name: m.name,
      busy: m.busy.map((b) => ({
        start: parseNaiveTimestamp(b.start),
        end: parseNaiveTimestamp(b.end),
      })),
    }))

    const carBusy: Interval[] = data.planning.carBusy.map((b) => ({
      start: parseNaiveTimestamp(b.start),
      end: parseNaiveTimestamp(b.end),
    }))

    // sharedReady uses longest-first as ticking the box would; singleReady uses admin's orderedTasks
    const sharedReady =
      pool.length >= 2
        ? suggestSchedule({
            now: effectiveNow,
            hours: data.planning.shopHours,
            mechanics,
            carBusy,
            tasks: sortLongestFirst(data.planning.tasks),
            preferredMechanicId: data.planning.preferredMechanicId,
            poolIds: pool,
            share: true,
          }).promisedDate
        : null

    let bestSingleMs = Infinity
    let singleReady: string | null = null

    for (const mechId of pool) {
      const res = suggestSchedule({
        now: effectiveNow,
        hours: data.planning.shopHours,
        mechanics,
        carBusy,
        tasks: orderedTasks,
        preferredMechanicId: data.planning.preferredMechanicId,
        poolIds: [mechId],
        share: false,
      })
      if (res.promisedDate) {
        const ms = parseNaiveTimestamp(res.promisedDate)
        if (!Number.isNaN(ms) && ms < bestSingleMs) {
          bestSingleMs = ms
          singleReady = res.promisedDate
        }
      }
    }

    return { sharedReady, singleReady }
  }, [data?.planning, start.date, start.time, pool, orderedTasks])

  const okPlacements = placements.filter(
    (p): p is Extract<Placement, { ok: true }> => p.ok,
  )

  const mechanicTotals = useMemo(() => {
    if (!data?.planning) return []
    const map = new Map<number, number>()
    for (const p of okPlacements) {
      map.set(p.mechanicId, (map.get(p.mechanicId) ?? 0) + p.hours)
    }
    const result: Array<{ id: number; name: string; hours: number }> = []
    for (const [id, totalHours] of map.entries()) {
      const mech = data.planning.mechanics.find((m) => m.id === id)
      if (mech) {
        result.push({ id, name: mech.name, hours: totalHours })
      }
    }
    return result
  }, [data?.planning, okPlacements])

  const handleSave = async () => {
    if (okPlacements.length === 0) return
    setSaving(true)

    let savedCount = 0
    for (let i = 0; i < okPlacements.length; i++) {
      const p = okPlacements[i]
      const res = await scheduleTask(
        jobOrderId,
        String(p.taskId),
        p.start,
        'pending',
        p.mechanicId,
      )

      if (!res.ok) {
        setSaving(false)
        const msg = res.message || 'Could not schedule task.'
        if (savedCount > 0) {
          toast.error(`Saved ${savedCount} of ${okPlacements.length} tasks. ${msg}`)
        } else {
          toast.error(msg)
        }
        return
      }
      savedCount++
    }

    if (promisedDate && !data?.alreadyPromised) {
      try {
        await fetch(`/api/job-orders/${jobOrderId}/progress/promised-date`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promisedDate }),
        })
      } catch (err) {
        console.error('Failed to set promised date:', err)
      }
    }

    setSaving(false)
    toast.success('Schedule saved.')
    onApplied()
  }

  const todayDateStr = data?.planning?.nowIso ? data.planning.nowIso.slice(0, 10) : ''

  const closingTimeText = useMemo(() => {
    if (!data?.planning || !start.date) return ''
    const parts = start.date.split('-').map(Number)
    if (parts.length !== 3 || parts.some(Number.isNaN)) return ''
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
    const weekday = d.getUTCDay()
    const dh = hoursForWeekday(data.planning.shopHours, weekday)
    if (!dh) return 'Shop is closed on this day.'
    const closeH = Math.floor(dh.close)
    const closeM = Math.round((dh.close % 1) * 60)
    return `Shop closes at ${formatTime(closeH, closeM)}.`
  }, [data?.planning, start.date])

  const availableToAdd = useMemo(() => {
    if (!data?.planning) return []
    return data.planning.mechanics.filter((m) => !pool.includes(m.id))
  }, [data?.planning, pool])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <CalendarDays size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Schedule job</h2>
              {data?.planning && (
                <p className="text-xs text-slate-400">
                  JO-{jobOrderId}, {data.planning.tasks.length} services.{' '}
                  {closingTimeText}
                </p>
              )}
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
            <p className="text-sm font-medium text-slate-600">
              There are no pending tasks to schedule or reschedule.
            </p>
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

            {/* Controls block */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
              {/* Row 1: Start date, Start time, Auto-schedule button */}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    min={todayDateStr}
                    value={start.date}
                    onChange={(e) =>
                      setStart((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start time
                  </label>
                  <input
                    type="time"
                    step="900"
                    value={start.time}
                    onChange={(e) =>
                      setStart((prev) => ({ ...prev, time: e.target.value }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSuggestForMe}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                >
                  <WandSparkles size={14} /> Auto-schedule
                </button>
              </div>

              {/* Row 2: Mechanics chips */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                <span className="block text-xs font-semibold text-slate-700">Mechanics</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {pool.map((mechId) => {
                    const mech = data.planning.mechanics.find((m) => m.id === mechId)
                    if (!mech) return null
                    return (
                      <span
                        key={mechId}
                        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                      >
                        {mech.name}
                        {pool.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFromPool(mechId)}
                            className="hover:text-indigo-900 font-bold ml-0.5 leading-none"
                            aria-label={`Remove ${mech.name}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    )
                  })}
                  {availableToAdd.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddToPool(Number(e.target.value))
                        }
                      }}
                      className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      aria-label="Add mechanic to job"
                    >
                      <option value="">+ Add mechanic</option>
                      {availableToAdd.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Row 3: Share the work checkbox */}
              {pool.length >= 2 && (
                <div className="space-y-1 pt-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={share}
                      onChange={(e) => handleToggleShare(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Share the work between them</span>
                  </label>
                  <p className="text-[11px] text-slate-500 pl-5">
                    Ticking this puts the longest service first. You can drag to change the order. At most{' '}
                    {MAX_MECHANICS_ON_CAR} mechanics work on one car at the same time.
                  </p>
                </div>
              )}

              {/* Row 4: Hint line */}
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                Auto-schedule keeps your order and replaces your mechanic and time choices.
              </p>
            </div>

            {/* Order presets */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-slate-500">Drag a card to change the order.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (data?.planning) {
                      setOrder(data.planning.tasks.map((t) => t.id))
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Original order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (data?.planning) {
                      setOrder(sortLongestFirst(data.planning.tasks).map((t) => t.id))
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Longest first
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (data?.planning) {
                      setOrder(sortMaintenanceShortFirst(data.planning.tasks).map((t) => t.id))
                    }
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  Maintenance / short first
                </button>
              </div>
            </div>

            {/* Table Header (hidden on mobile) */}
            <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_96px_minmax(0,1.5fr)_minmax(0,1.7fr)] gap-3 px-3 text-[11px] font-semibold tracking-wide text-slate-400">
              <div>SERVICE</div>
              <div>DURATION</div>
              <div>MECHANIC</div>
              <div>SCHEDULED TIME</div>
            </div>

            {/* Table rows */}
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
              {orderedTasks.map((task, index) => {
                const placement = placements.find((p) => p.taskId === task.id)
                const isPinned = pinned[task.id] !== undefined
                const isBlocked = Boolean(task.blockedBy)

                const typePill = serviceTypeLabel(task.serviceType)

                const onJobMechs = data.planning.mechanics.filter((m) =>
                  pool.includes(m.id),
                )
                const otherMechs = data.planning.mechanics.filter(
                  (m) => !pool.includes(m.id),
                )
                const useGroups = onJobMechs.length > 0 && otherMechs.length > 0

                return (
                  <div
                    key={task.id}
                    // The whole card is the drag handle, except the controls inside it
                    // (dropdown, time inputs, buttons), so those keep working normally.
                    onMouseDown={(e) => {
                      const onControl = (e.target as HTMLElement).closest(
                        'select, input, button, a, label, textarea',
                      )
                      setDragReadyId(onControl ? null : task.id)
                    }}
                    onMouseUp={() => setDragReadyId(null)}
                    draggable={dragReadyId === task.id}
                    onDragStart={(e) => {
                      setDragId(task.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(task.id))
                    }}
                    onDragOver={(e) => {
                      if (dragId === null) return
                      e.preventDefault()
                      setOverId(task.id)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragId !== null) moveTask(dragId, index)
                      setDragId(null)
                      setOverId(null)
                      setDragReadyId(null)
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverId(null)
                      setDragReadyId(null)
                    }}
                    className={`cursor-grab rounded-xl border bg-white p-3 text-xs transition-colors active:cursor-grabbing ${
                      dragId === task.id ? 'opacity-60' : ''
                    } ${
                      overId === task.id && dragId !== null && dragId !== task.id
                        ? 'border-indigo-400 ring-1 ring-indigo-300'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_96px_minmax(0,1.5fr)_minmax(0,1.7fr)] md:items-center">
                      {/* 1. Service */}
                      <div className="flex items-start gap-2">
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">
                            <span className="text-[11px] font-semibold text-slate-400 mr-1.5">
                              {index + 1}.
                            </span>
                            {task.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {typePill && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                                {typePill}
                              </span>
                            )}
                            {isPinned && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                                Set by you
                              </span>
                            )}
                            {isBlocked && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                                Waiting for part
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 2. Duration */}
                      <div>
                        <span className="md:hidden text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                          Duration
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock size={13} className="text-slate-400 shrink-0" />
                          <span>{formatHours(task.hours)}</span>
                        </div>
                      </div>

                      {/* 3. Mechanic */}
                      <div>
                        <span className="md:hidden text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                          Mechanic
                        </span>
                        <select
                          value={assignments[task.id] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null
                            if (val != null) {
                              setAssignments((prev) => ({ ...prev, [task.id]: val }))
                              if (!pool.includes(val)) {
                                setPool((prev) => [...prev, val])
                              }
                            }
                          }}
                          disabled={isBlocked}
                          aria-label={`Mechanic for ${task.title}`}
                          className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
                        >
                          {assignments[task.id] == null && (
                            <option value="" disabled>
                              Not assigned
                            </option>
                          )}
                          {useGroups ? (
                            <>
                              <optgroup label="On this job">
                                {onJobMechs.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Other mechanics">
                                {otherMechs.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                              </optgroup>
                            </>
                          ) : (
                            data.planning.mechanics.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      {/* 4. Scheduled time */}
                      <div>
                        <span className="md:hidden text-[10px] font-semibold uppercase text-slate-400 block mb-0.5">
                          Scheduled time
                        </span>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                          <div className="min-w-0">
                            {placement?.ok ? (
                              (() => {
                                const { dateLine, timeLine } = formatPlacementLines(
                                  placement.start,
                                  placement.end,
                                )
                                return (
                                  <div>
                                    <p className="font-semibold text-slate-900 leading-tight">
                                      {dateLine}
                                    </p>
                                    <p className="text-slate-500 leading-tight">
                                      {timeLine}
                                    </p>
                                  </div>
                                )
                              })()
                            ) : (
                              <p className="text-amber-700 font-medium">
                                {placement?.reason ?? 'Not scheduled'}
                              </p>
                            )}
                          </div>

                          {!isBlocked && (
                            <div className="shrink-0">
                              {isPinned ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPinned((prev) => {
                                      const next = { ...prev }
                                      delete next[task.id]
                                      return next
                                    })
                                  }}
                                  className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                                >
                                  Use automatic time
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const defaultDate =
                                      placement && placement.ok
                                        ? placement.start.slice(0, 10)
                                        : start.date
                                    const defaultTime =
                                      placement && placement.ok
                                        ? placement.start.slice(11, 16)
                                        : start.time
                                    setPinned((prev) => ({
                                      ...prev,
                                      [task.id]: {
                                        date: defaultDate,
                                        time: defaultTime,
                                      },
                                    }))
                                  }}
                                  className="whitespace-nowrap rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-100"
                                >
                                  Change time
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pinned editor */}
                    {isPinned && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <span className="text-xs font-medium text-slate-700">
                          Start this service at
                        </span>
                        <input
                          type="date"
                          min={todayDateStr}
                          value={pinned[task.id].date}
                          onChange={(e) => {
                            const val = e.target.value
                            setPinned((prev) => ({
                              ...prev,
                              [task.id]: { ...prev[task.id], date: val },
                            }))
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <input
                          type="time"
                          step="900"
                          value={pinned[task.id].time}
                          onChange={(e) => {
                            const val = e.target.value
                            setPinned((prev) => ({
                              ...prev,
                              [task.id]: { ...prev[task.id], time: val },
                            }))
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        {(!pinned[task.id].date || !pinned[task.id].time) && (
                          <span className="text-amber-700 font-medium">
                            Enter a date and a time.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Per mechanic totals under table */}
            {pool.length >= 2 && mechanicTotals.length > 0 && (
              <p className="text-[11px] text-slate-500 px-1">
                Work per mechanic:{' '}
                {mechanicTotals.map((m) => `${m.name} ${formatHours(m.hours)}`).join(', ')}
              </p>
            )}

            {/* Target completion */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Clock size={18} className="text-slate-400 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-500">Target completion</p>
                <p className="text-sm font-semibold text-slate-900">
                  {data.alreadyPromised
                    ? `Already promised: ${formatPromisedDate(data.alreadyPromised)}`
                    : promisedDate
                    ? `Ready by ${formatPromisedDate(promisedDate)}`
                    : 'Ready-by date will be set when every task has a time.'}
                </p>
                {/* Comparison lines: compare automatic plans from the same start; ignore row edits */}
                {!data.alreadyPromised && (
                  <>
                    {share && singleReady && singleReady !== promisedDate && (
                      <p className="text-[11px] text-slate-500">
                        One mechanic alone: Ready by {formatPromisedDate(singleReady)}
                      </p>
                    )}
                    {!share && pool.length >= 2 && sharedReady && sharedReady !== promisedDate && (
                      <p className="text-[11px] text-slate-500">
                        If shared: Ready by {formatPromisedDate(sharedReady)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || okPlacements.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={13} /> Save schedule
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
