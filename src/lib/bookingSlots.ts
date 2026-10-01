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

  return { occupiedByDate, slots }
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
