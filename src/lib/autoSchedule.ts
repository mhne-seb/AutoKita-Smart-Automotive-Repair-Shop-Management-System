import {
  hoursForWeekday,
  withMargin,
  DEFAULT_OPEN_HOUR,
  DEFAULT_CLOSE_HOUR,
  type ShopHours,
} from '@/lib/bookingTiming'
import { TASK_GAP_MINUTES, SLOT_STEP_MINUTES, MAX_MECHANICS_ON_CAR } from '@/data/shopPolicy'

export type Interval = { start: number; end: number } // naive milliseconds

// Highest number of intervals that are active at the same time inside `window`.
export function maxConcurrent(window: Interval, intervals: Interval[]): number {
  const events: Array<[number, number]> = []
  for (const iv of intervals) {
    const s = Math.max(iv.start, window.start)
    const e = Math.min(iv.end, window.end)
    if (s < e) {
      events.push([s, 1])
      events.push([e, -1])
    }
  }
  // At the same moment, process ends (-1) before starts (+1)
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let current = 0
  let peak = 0
  for (const [, delta] of events) {
    current += delta
    if (current > peak) peak = current
  }
  return peak
}

export type MechanicInput = { id: number; name: string; busy: Interval[] }
export type TaskInput = {
  id: number
  title: string
  hours: number
  blockedBy: string | null
  partExpected: string | null
}
export type Suggestion =
  | {
      taskId: number
      title: string
      ok: true
      mechanicId: number
      mechanicName: string
      start: string
      end: string
      hours: number
    }
  | { taskId: number; title: string; ok: false; reason: string }

export type Placement =
  | {
      taskId: number
      title: string
      ok: true
      mechanicId: number
      mechanicName: string
      start: string
      end: string
      hours: number
      pinned: boolean
    }
  | { taskId: number; title: string; ok: false; reason: string }

// Parse naive timestamp "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:00" into UTC milliseconds
export function parseNaiveTimestamp(str: string): number {
  const m = str.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return NaN
  return Date.UTC(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
    parseInt(m[4], 10),
    parseInt(m[5], 10),
    m[6] ? parseInt(m[6], 10) : 0,
  )
}

// Format naive UTC timestamp (ms) to "YYYY-MM-DDTHH:mm:00"
export function formatNaiveIso(ms: number): string {
  const d = new Date(ms)
  const Y = d.getUTCFullYear()
  const M = String(d.getUTCMonth() + 1).padStart(2, '0')
  const D = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${Y}-${M}-${D}T${h}:${m}:00`
}

// Start of the UTC calendar day
function getUtcDayStart(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)
}

// Round naive timestamp UP to next SLOT_STEP_MINUTES
export function roundUpToStepMs(ms: number): number {
  const stepMs = SLOT_STEP_MINUTES * 60 * 1000
  return Math.ceil(ms / stepMs) * stepMs
}
const roundUpToStep = roundUpToStepMs

// Ensure shop hours are a valid object; default open on Mon-Sat and closed on Sun
export function normalizeShopHours(raw: unknown): ShopHours {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      obj = null
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    const defaultRange = `${String(DEFAULT_OPEN_HOUR).padStart(2, '0')}:00-${String(DEFAULT_CLOSE_HOUR).padStart(2, '0')}:00`
    return {
      monday: defaultRange,
      tuesday: defaultRange,
      wednesday: defaultRange,
      thursday: defaultRange,
      friday: defaultRange,
      saturday: defaultRange,
      sunday: 'closed',
    }
  }
  return obj as ShopHours
}

// Compute the working intervals and final end time for a given task duration across shop hours
function getWorkingChunks(
  startMs: number,
  taskHours: number,
  shopHours: ShopHours,
): { chunks: Interval[]; endMs: number } {
  let remainingMs = Math.round(taskHours * 3600 * 1000)
  let currentMs = startMs
  const chunks: Interval[] = []

  // Up to 60 days of search
  for (let safety = 0; safety < 60 && remainingMs > 0; safety++) {
    const dayStart = getUtcDayStart(currentMs)
    const weekday = new Date(currentMs).getUTCDay()
    const dayHours = hoursForWeekday(shopHours, weekday)

    if (!dayHours) {
      // Shop closed on this day, skip to start of next day
      currentMs = dayStart + 24 * 3600 * 1000
      continue
    }

    const dayOpenMs = dayStart + Math.round(dayHours.open * 60) * 60 * 1000
    const dayCloseMs = dayStart + Math.round(dayHours.close * 60) * 60 * 1000

    if (currentMs < dayOpenMs) {
      currentMs = dayOpenMs
    }

    if (currentMs >= dayCloseMs) {
      currentMs = dayStart + 24 * 3600 * 1000
      continue
    }

    const availableToday = dayCloseMs - currentMs
    if (remainingMs <= availableToday) {
      const endChunk = currentMs + remainingMs
      chunks.push({ start: currentMs, end: endChunk })
      return { chunks, endMs: endChunk }
    }

    chunks.push({ start: currentMs, end: dayCloseMs })
    remainingMs -= availableToday
    currentMs = dayStart + 24 * 3600 * 1000
  }

  return { chunks, endMs: currentMs }
}

// Add working hours (e.g. safety margin) starting from startMs
function computeWorkingEnd(startMs: number, hoursToAdd: number, shopHours: ShopHours): number {
  if (hoursToAdd <= 0) return startMs
  const { endMs } = getWorkingChunks(startMs, hoursToAdd, shopHours)
  return endMs
}

// Find the earliest valid start and end time for a specific mechanic
export function findEarliestSlotForMechanic(
  earliestAllowed: number,
  taskHours: number,
  mechanicBusy: Interval[],
  carBusy: Interval[],
  shopHours: ShopHours,
  maxOnCar?: number,
): { start: number; end: number } | null {
  const gapMs = TASK_GAP_MINUTES * 60 * 1000
  const taskMs = Math.round(taskHours * 3600 * 1000)

  let t = roundUpToStep(earliestAllowed)

  for (let safety = 0; safety < 500; safety++) {
    const dayStart = getUtcDayStart(t)
    const weekday = new Date(t).getUTCDay()
    const dayHours = hoursForWeekday(shopHours, weekday)

    // Skip closed days
    if (!dayHours) {
      t = roundUpToStep(dayStart + 24 * 3600 * 1000)
      continue
    }

    const dayOpenMs = dayStart + Math.round(dayHours.open * 60) * 60 * 1000
    const dayCloseMs = dayStart + Math.round(dayHours.close * 60) * 60 * 1000

    // If before opening, snap to open
    if (t < dayOpenMs) {
      t = dayOpenMs
    }

    // If at or after closing, advance to next day
    if (t >= dayCloseMs) {
      t = roundUpToStep(dayStart + 24 * 3600 * 1000)
      continue
    }

    // Rule 4: If task is shorter than or equal to day's opening hours and cannot finish before closing,
    // it starts at the next open day's opening time.
    const dayCapacityMs = dayCloseMs - dayOpenMs
    if (taskMs <= dayCapacityMs && t + taskMs > dayCloseMs) {
      t = roundUpToStep(dayStart + 24 * 3600 * 1000)
      continue
    }

    // Compute working chunks and finish time
    const { chunks, endMs } = getWorkingChunks(t, taskHours, shopHours)

    // Check conflict with mechanic busy intervals (widened by TASK_GAP_MINUTES)
    let conflictEnd = 0
    for (const chunk of chunks) {
      for (const b of mechanicBusy) {
        const bStart = b.start - gapMs
        const bEnd = b.end + gapMs
        if (Math.max(chunk.start, bStart) < Math.min(chunk.end, bEnd)) {
          if (bEnd > conflictEnd) conflictEnd = bEnd
        }
      }
      if (maxOnCar === undefined) {
        for (const c of carBusy) {
          const cStart = c.start - gapMs
          const cEnd = c.end + gapMs
          if (Math.max(chunk.start, cStart) < Math.min(chunk.end, cEnd)) {
            if (cEnd > conflictEnd) conflictEnd = cEnd
          }
        }
      } else if (maxConcurrent(chunk, carBusy) >= maxOnCar) {
        // The car already has the most mechanics it may have in this part of the day.
        // Jump to the earliest end among the car's intervals that overlap this chunk.
        let soonest = Infinity
        for (const c of carBusy) {
          if (Math.max(chunk.start, c.start) < Math.min(chunk.end, c.end) && c.end < soonest) {
            soonest = c.end
          }
        }
        if (soonest !== Infinity && soonest > conflictEnd) conflictEnd = soonest
      }
    }

    if (conflictEnd > 0) {
      // Jump past the conflicting interval
      t = roundUpToStep(conflictEnd)
      continue
    }

    // Valid slot found
    return { start: t, end: endMs }
  }

  return null
}

// Calculate total busy minutes for a mechanic on a specific calendar day (UTC)
function getMechanicDayBusyMinutes(busy: Interval[], dayMs: number): number {
  const dayStart = getUtcDayStart(dayMs)
  const dayEnd = dayStart + 24 * 3600 * 1000
  let totalOverlapMs = 0
  for (const b of busy) {
    const overlap = Math.max(0, Math.min(b.end, dayEnd) - Math.max(b.start, dayStart))
    totalOverlapMs += overlap
  }
  return Math.round(totalOverlapMs / (60 * 1000))
}

export function suggestSchedule(input: {
  now: number
  hours: ShopHours
  mechanics: MechanicInput[]
  carBusy: Interval[]
  tasks: TaskInput[]
  preferredMechanicId: number | null
  poolIds?: number[] | null
  share?: boolean
}): { suggestions: Suggestion[]; promisedDate: string | null } {
  const { now, hours, preferredMechanicId } = input
  let workingMechanics = input.mechanics
  if (input.poolIds && input.poolIds.length > 0) {
    const poolSet = new Set(input.poolIds)
    workingMechanics = input.mechanics.filter((m) => poolSet.has(m.id))
  }
  const mechanics = workingMechanics.map((m) => ({
    id: m.id,
    name: m.name,
    busy: [...m.busy],
  }))
  const carBusy = [...input.carBusy]

  const suggestions: Suggestion[] = []
  const gapMs = TASK_GAP_MINUTES * 60 * 1000
  const roundedNow = roundUpToStep(now)

  const tasksToProcess = input.share
    ? [...input.tasks].sort((a, b) => {
        if (b.hours !== a.hours) return b.hours - a.hours
        return input.tasks.indexOf(a) - input.tasks.indexOf(b)
      })
    : input.tasks

  for (const task of tasksToProcess) {
    // If blocked by a part, do not schedule
    if (task.blockedBy) {
      let reason = `Waiting for a part: ${task.blockedBy}.`
      if (task.partExpected) {
        const expectedMs = parseNaiveTimestamp(task.partExpected)
        if (!Number.isNaN(expectedMs)) {
          const expDate = new Date(expectedMs)
          const monD = expDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })
          reason += ` Expected ${monD}.`
        }
      }
      suggestions.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason,
      })
      continue
    }

    if (mechanics.length === 0) {
      suggestions.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason: 'No mechanic is available.',
      })
      continue
    }

    // Earliest start cannot be before now or before the car's last scheduled task ends plus gap
    const carLatestEnd = carBusy.length > 0 ? Math.max(...carBusy.map((b) => b.end)) + gapMs : 0
    const earliestAllowed = input.share ? roundedNow : Math.max(roundedNow, carLatestEnd)

    // Evaluate candidates across all mechanics
    type Candidate = {
      mechanic: (typeof mechanics)[0]
      start: number
      end: number
      dayBusyMinutes: number
    }

    const candidates: Candidate[] = []

    for (const mech of mechanics) {
      const slot = findEarliestSlotForMechanic(
        earliestAllowed,
        task.hours,
        mech.busy,
        carBusy,
        hours,
        input.share ? MAX_MECHANICS_ON_CAR : undefined,
      )
      if (slot) {
        candidates.push({
          mechanic: mech,
          start: slot.start,
          end: slot.end,
          dayBusyMinutes: getMechanicDayBusyMinutes(mech.busy, slot.start),
        })
      }
    }

    if (candidates.length === 0) {
      suggestions.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason: 'No mechanic is available.',
      })
      continue
    }

    // Select mechanic whose task ends earliest.
    // Ties: preferredMechanicId first, then fewer busy minutes on that day, then lower id.
    candidates.sort((a, b) => {
      if (a.end !== b.end) return a.end - b.end

      const aPref = preferredMechanicId !== null && a.mechanic.id === preferredMechanicId
      const bPref = preferredMechanicId !== null && b.mechanic.id === preferredMechanicId
      if (aPref && !bPref) return -1
      if (bPref && !aPref) return 1

      if (a.dayBusyMinutes !== b.dayBusyMinutes) return a.dayBusyMinutes - b.dayBusyMinutes

      return a.mechanic.id - b.mechanic.id
    })

    const chosen = candidates[0]

    // Record the assigned slot
    const assignedInterval: Interval = { start: chosen.start, end: chosen.end }
    chosen.mechanic.busy.push(assignedInterval)
    carBusy.push(assignedInterval)

    suggestions.push({
      taskId: task.id,
      title: task.title,
      ok: true,
      mechanicId: chosen.mechanic.id,
      mechanicName: chosen.mechanic.name,
      start: formatNaiveIso(chosen.start),
      end: formatNaiveIso(chosen.end),
      hours: task.hours,
    })
  }

  // Return suggestions in the original task order
  if (input.share) {
    const taskIndexMap = new Map(input.tasks.map((t, idx) => [t.id, idx]))
    suggestions.sort(
      (a, b) => (taskIndexMap.get(a.taskId) ?? 0) - (taskIndexMap.get(b.taskId) ?? 0),
    )
  }

  // Compute promisedDate
  // null when any task is blocked by a part or could not be scheduled, or if there are no tasks
  const hasFailedTask = suggestions.some((s) => !s.ok)
  if (hasFailedTask || input.tasks.length === 0) {
    return { suggestions, promisedDate: null }
  }

  const okSuggestions = suggestions.filter((s): s is Extract<Suggestion, { ok: true }> => s.ok)
  const totalHours = okSuggestions.reduce((sum, s) => sum + s.hours, 0)
  const marginHours = withMargin(totalHours) - totalHours

  const allEnds = [
    ...okSuggestions.map((s) => parseNaiveTimestamp(s.end)),
    ...input.carBusy.map((b) => b.end),
  ]
  const latestEndMs = Math.max(...allEnds)

  const promisedMs = computeWorkingEnd(latestEndMs, marginHours, hours)
  const promisedDate = formatNaiveIso(promisedMs)

  return { suggestions, promisedDate }
}

export function layoutJob(input: {
  now: number
  start: number
  hours: ShopHours
  mechanics: MechanicInput[]
  carBusy: Interval[]
  tasks: TaskInput[]
  assignments: Record<number, number | null>
  pinned: Record<number, number>
  share?: boolean
}): { placements: Placement[]; promisedDate: string | null } {
  const mechanics = input.mechanics.map((m) => ({
    id: m.id,
    name: m.name,
    busy: [...m.busy],
  }))
  const carBusy = [...input.carBusy]
  const gapMs = TASK_GAP_MINUTES * 60 * 1000
  const roundedNow = roundUpToStepMs(input.now)
  const placements: Placement[] = []

  for (const task of input.tasks) {
    // 1. blockedBy is set
    if (task.blockedBy) {
      let reason = `Waiting for a part: ${task.blockedBy}.`
      if (task.partExpected) {
        const expectedMs = parseNaiveTimestamp(task.partExpected)
        if (!Number.isNaN(expectedMs)) {
          const expDate = new Date(expectedMs)
          const monD = expDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          })
          reason += ` Expected ${monD}.`
        }
      }
      placements.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason,
      })
      continue
    }

    // 2. No mechanic chosen, or chosen id not in mechanics
    const chosenMechId = input.assignments[task.id]
    const chosenMech =
      chosenMechId != null ? mechanics.find((m) => m.id === chosenMechId) : null
    if (!chosenMech) {
      placements.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason: 'Choose a mechanic.',
      })
      continue
    }

    // 3. Pinned: place exactly at that time
    if (input.pinned[task.id] !== undefined) {
      const pinMs = input.pinned[task.id]

      if (pinMs < roundedNow) {
        placements.push({
          taskId: task.id,
          title: task.title,
          ok: false,
          reason: 'That time has already passed.',
        })
        continue
      }

      const dayStart = getUtcDayStart(pinMs)
      const weekday = new Date(pinMs).getUTCDay()
      const dayHours = hoursForWeekday(input.hours, weekday)
      if (!dayHours) {
        placements.push({
          taskId: task.id,
          title: task.title,
          ok: false,
          reason: 'Outside shop hours.',
        })
        continue
      }

      const dayOpenMs = dayStart + Math.round(dayHours.open * 60) * 60 * 1000
      const dayCloseMs = dayStart + Math.round(dayHours.close * 60) * 60 * 1000
      if (pinMs < dayOpenMs || pinMs >= dayCloseMs) {
        placements.push({
          taskId: task.id,
          title: task.title,
          ok: false,
          reason: 'Outside shop hours.',
        })
        continue
      }

      const { chunks, endMs } = getWorkingChunks(pinMs, task.hours, input.hours)

      let mechConflict = false
      for (const chunk of chunks) {
        for (const b of chosenMech.busy) {
          const bStart = b.start - gapMs
          const bEnd = b.end + gapMs
          if (Math.max(chunk.start, bStart) < Math.min(chunk.end, bEnd)) {
            mechConflict = true
            break
          }
        }
        if (mechConflict) break
      }
      if (mechConflict) {
        placements.push({
          taskId: task.id,
          title: task.title,
          ok: false,
          reason: `${chosenMech.name} is busy then.`,
        })
        continue
      }

      let carConflict = false
      let carConflictReason = 'This car is busy then.'

      if (input.share) {
        for (const chunk of chunks) {
          if (maxConcurrent(chunk, carBusy) >= MAX_MECHANICS_ON_CAR) {
            carConflict = true
            carConflictReason = `Already ${MAX_MECHANICS_ON_CAR} mechanics on this car then.`
            break
          }
        }
      } else {
        for (const chunk of chunks) {
          for (const c of carBusy) {
            const cStart = c.start - gapMs
            const cEnd = c.end + gapMs
            if (Math.max(chunk.start, cStart) < Math.min(chunk.end, cEnd)) {
              carConflict = true
              break
            }
          }
          if (carConflict) break
        }
      }

      if (carConflict) {
        placements.push({
          taskId: task.id,
          title: task.title,
          ok: false,
          reason: carConflictReason,
        })
        continue
      }

      const assignedInterval: Interval = { start: pinMs, end: endMs }
      chosenMech.busy.push(assignedInterval)
      carBusy.push(assignedInterval)

      placements.push({
        taskId: task.id,
        title: task.title,
        ok: true,
        mechanicId: chosenMech.id,
        mechanicName: chosenMech.name,
        start: formatNaiveIso(pinMs),
        end: formatNaiveIso(endMs),
        hours: task.hours,
        pinned: true,
      })
      continue
    }

    // 4. Not pinned: earliest allowed = max(roundUp(max(now, start)), latest end of carBusy + gap)
    const baseStart = roundUpToStepMs(Math.max(input.now, input.start))
    const carLatestEnd =
      carBusy.length > 0 ? Math.max(...carBusy.map((b) => b.end)) + gapMs : 0
    const earliestAllowed = input.share ? baseStart : Math.max(baseStart, carLatestEnd)

    const slot = findEarliestSlotForMechanic(
      earliestAllowed,
      task.hours,
      chosenMech.busy,
      carBusy,
      input.hours,
      input.share ? MAX_MECHANICS_ON_CAR : undefined,
    )

    if (!slot) {
      placements.push({
        taskId: task.id,
        title: task.title,
        ok: false,
        reason: 'No time found.',
      })
      continue
    }

    // 5. On success add the interval to that mechanic's busy list and to carBusy
    const assignedInterval: Interval = { start: slot.start, end: slot.end }
    chosenMech.busy.push(assignedInterval)
    carBusy.push(assignedInterval)

    placements.push({
      taskId: task.id,
      title: task.title,
      ok: true,
      mechanicId: chosenMech.id,
      mechanicName: chosenMech.name,
      start: formatNaiveIso(slot.start),
      end: formatNaiveIso(slot.end),
      hours: task.hours,
      pinned: false,
    })
  }

  // promisedDate: null unless EVERY task is ok
  const hasFailedTask = placements.some((p) => !p.ok)
  if (hasFailedTask || input.tasks.length === 0) {
    return { placements, promisedDate: null }
  }

  const okPlacements = placements.filter(
    (p): p is Extract<Placement, { ok: true }> => p.ok,
  )
  const totalHours = okPlacements.reduce((sum, p) => sum + p.hours, 0)
  const marginHours = withMargin(totalHours) - totalHours

  const allEnds = [
    ...okPlacements.map((p) => parseNaiveTimestamp(p.end)),
    ...input.carBusy.map((b) => b.end),
  ]
  const latestEndMs = Math.max(...allEnds)

  const promisedMs = computeWorkingEnd(latestEndMs, marginHours, input.hours)
  const promisedDate = formatNaiveIso(promisedMs)

  return { placements, promisedDate }
}
