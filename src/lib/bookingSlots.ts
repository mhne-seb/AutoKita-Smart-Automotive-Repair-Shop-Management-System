import { db } from './db'
import {
  BOOKING_TIMES,
  MANILA_TIMEZONE,
  normalizeTimeSlot,
  formatManilaDate,
  formatManilaTime,
  toManilaIso,
} from './bookingSlotsShared'

export {
  BOOKING_TIMES,
  MANILA_TIMEZONE,
  normalizeTimeSlot,
  formatManilaDate,
  formatManilaTime,
  toManilaIso,
}

/**
 * Returns all active occupied slots from the database.
 * An appointment occupies a slot if:
 * 1. preferred_datetime is not null
 * 2. ticket_status is not 'cancelled' and not 'declined'
 * 3. the associated job order (if any) does not have status 'cancelled'
 */
export async function getOccupiedBookingSlots() {
  const query = `
    SELECT 
      st.id AS ticket_id,
      st.preferred_datetime,
      st.ticket_status,
      jo.id AS job_order_id,
      jo.status AS job_order_status
    FROM service_tickets st
    LEFT JOIN job_orders jo ON jo.ticket_id = st.id
    WHERE st.preferred_datetime IS NOT NULL
      AND st.preferred_datetime >= (NOW() - INTERVAL '2 days')
      AND st.ticket_status NOT IN ('cancelled', 'declined')
      AND (jo.status IS NULL OR jo.status NOT IN ('completed', 'released', 'cancelled'))
    ORDER BY st.preferred_datetime ASC
  `
  const result = await db.query(query)

  const occupiedByDate: Record<string, string[]> = {}
  const slots: Array<{
    ticketId: number
    jobOrderId: number | null
    ticketStatus: string
    jobOrderStatus: string | null
    date: string
    time: string
    iso: string
  }> = []

  for (const row of result.rows) {
    const d = new Date(row.preferred_datetime)
    const dateStr = formatManilaDate(d)
    const timeStr = formatManilaTime(d)

    if (!occupiedByDate[dateStr]) {
      occupiedByDate[dateStr] = []
    }
    const normalized = normalizeTimeSlot(timeStr)
    if (!occupiedByDate[dateStr].includes(normalized)) {
      occupiedByDate[dateStr].push(normalized)
    }

    slots.push({
      ticketId: row.ticket_id,
      jobOrderId: row.job_order_id,
      ticketStatus: row.ticket_status,
      jobOrderStatus: row.job_order_status,
      date: dateStr,
      time: normalized,
      iso: d.toISOString(),
    })
  }

  // Query active mechanics
  const mechRes = await db.query(
    `SELECT id, full_name FROM employees WHERE role = 'mechanic' AND status = 'active'`
  )
  const activeMechanics = mechRes.rows
  const activeCount = activeMechanics.length

  // Query ongoing tasks in service_progress_tasks for the upcoming 60 days
  const tasksRes = await db.query(
    `SELECT 
       spt.id,
       COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) AS mechanic_id,
       e.full_name AS mechanic_name,
       COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
       COALESCE(
         spt.estimated_finish,
         spt.scheduled_date + (COALESCE(jos.estimated_hours, 1.5) * INTERVAL '1 hour')
       )::text AS estimated_finish,
       COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours
     FROM service_progress_tasks spt
     JOIN job_orders jo ON jo.id = spt.job_order_id
     LEFT JOIN employees e ON e.id = COALESCE(spt.mechanic_id, jo.assigned_mechanic_id)
     LEFT JOIN LATERAL (
       SELECT jos.estimated_hours
       FROM services s
       JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
       WHERE s.service_name = spt.task_title
       LIMIT 1
     ) jos ON true
     WHERE spt.task_status <> 'cancelled'
       AND jo.status NOT IN ('completed', 'released', 'cancelled')
       AND (spt.scheduled_date IS NOT NULL OR spt.started_at IS NOT NULL)
       AND COALESCE(spt.scheduled_date, spt.started_at) >= (NOW() - INTERVAL '1 day')
     ORDER BY scheduled_date ASC`
  )

  const busyDatesSet = new Set<string>()
  const earliestAvailableByDate: Record<string, { availableFrom: string; mechanicName: string }> = {}

  if (activeCount > 0) {
    const tasksByDate: Record<string, typeof tasksRes.rows> = {}
    for (const t of tasksRes.rows) {
      if (!t.scheduled_date) continue
      const dt = new Date(t.scheduled_date)
      const dStr = formatManilaDate(dt)
      if (!tasksByDate[dStr]) tasksByDate[dStr] = []
      tasksByDate[dStr].push(t)
    }

    for (const [dStr, dayTasks] of Object.entries(tasksByDate)) {
      const mechHours: Record<number, number> = {}
      const mechLatestFinish: Record<number, number> = {}
      for (const m of activeMechanics) {
        mechHours[m.id] = 0
        mechLatestFinish[m.id] = 0
      }

      for (const t of dayTasks) {
        const mId = Number(t.mechanic_id)
        if (mechHours[mId] !== undefined) {
          mechHours[mId] += Number(t.estimated_hours || 1.5)
          const finishMs = t.estimated_finish ? new Date(t.estimated_finish).getTime() : 0
          if (finishMs > mechLatestFinish[mId]) {
            mechLatestFinish[mId] = finishMs
          }
        }
      }

      // If all active mechanics have >= 5.5 hours booked, or overall shop workload >= activeCount * 6.0 hrs
      const allMechsBusy = activeMechanics.every((m) => (mechHours[m.id] || 0) >= 5.5)
      const totalHours = Object.values(mechHours).reduce((a, b) => a + b, 0)
      const isCapacityFull = totalHours >= activeCount * 6.0

      if (allMechsBusy || isCapacityFull) {
        busyDatesSet.add(dStr)

        let soonestMech: { id: number; name: string; finishMs: number } | null = null
        for (const m of activeMechanics) {
          const fMs = mechLatestFinish[m.id] || 0
          if (!soonestMech || (fMs > 0 && fMs < soonestMech.finishMs)) {
            soonestMech = { id: m.id, name: m.full_name, finishMs: fMs }
          }
        }

        if (soonestMech && soonestMech.finishMs > 0) {
          const availDate = new Date(soonestMech.finishMs)
          earliestAvailableByDate[dStr] = {
            availableFrom: availDate.toISOString(),
            mechanicName: soonestMech.name,
          }
        }
      }
    }
  }

  const busyDates = Array.from(busyDatesSet)
  return { occupiedByDate, slots, busyDates, earliestAvailableByDate }
}

/**
 * Checks whether a requested preferred_datetime conflicts with an existing active booking.
 * A conflict occurs if another active booking is at the exact time or within 30 minutes.
 * Returns true if the slot is occupied, false otherwise.
 */
export async function isSlotOccupiedInDb(preferredDatetime: string, client?: any): Promise<boolean> {
  const executor = client || db
  const res = await executor.query(
    `SELECT st.id
     FROM service_tickets st
     LEFT JOIN job_orders jo ON jo.ticket_id = st.id
     WHERE st.preferred_datetime IS NOT NULL
       AND ABS(EXTRACT(EPOCH FROM (st.preferred_datetime - $1::timestamptz))) < 1800
       AND st.ticket_status NOT IN ('cancelled', 'declined')
       AND (jo.status IS NULL OR jo.status NOT IN ('completed', 'released', 'cancelled'))
     LIMIT 1`,
    [preferredDatetime]
  )
  return res.rows.length > 0
}
