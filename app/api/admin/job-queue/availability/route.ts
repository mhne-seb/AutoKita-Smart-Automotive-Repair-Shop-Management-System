import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authGuard'
import { db } from '@/lib/db'
import { getServicesForTicket } from '@/lib/syncBookedServices'
import {
  findEarliestSlotForMechanic,
  normalizeShopHours,
  parseNaiveTimestamp,
  formatNaiveIso,
  roundUpToStepMs,
  type Interval,
} from '@/lib/autoSchedule'
import { TASK_GAP_MINUTES, SHOP_LUNCH_START_HOUR, SHOP_LUNCH_END_HOUR } from '@/data/shopPolicy'

export const dynamic = 'force-dynamic'

interface SimulatedSlot {
  serviceId: number
  serviceName: string
  durationHours: number
  startIso: string
  endIso: string
  displayStart: string
  displayEnd: string
  spansLunch: boolean
}

function formatNaiveDisplay(ms: number | null | undefined): string {
  if (!ms || !isFinite(ms) || isNaN(ms)) return '—'
  const d = new Date(ms)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = monthNames[d.getUTCMonth()]
  const day = d.getUTCDate()
  const year = d.getUTCFullYear()
  const rawH = d.getUTCHours()
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  const ampm = rawH >= 12 ? 'PM' : 'AM'
  const h = rawH % 12 === 0 ? 12 : rawH % 12
  return `${month} ${day}, ${year}, ${h}:${m} ${ampm}`
}

export async function GET(req: NextRequest) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const ticketIdParam = searchParams.get('ticketId')
    const ticketId = parseInt(ticketIdParam || '', 10)

    if (isNaN(ticketId) || ticketId <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid ticketId' }, { status: 400 })
    }

    // 1. Fetch ticket and vehicle details
    const ticketRes = await db.query(
      `SELECT 
         st.id,
         st.preferred_datetime::text AS preferred_datetime,
         st.request_date::text AS request_date,
         st.customer_concern,
         st.assigned_mechanic_id,
         st.ticket_status,
         u.first_name,
         u.last_name,
         u.contact_number,
         v.vehicle_model,
         v.vehicle_year,
         v.plate_number
       FROM service_tickets st
       JOIN users u ON u.id = st.user_id
       JOIN vehicles v ON v.id = st.vehicle_id
       WHERE st.id = $1`,
      [ticketId]
    )

    if (ticketRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Ticket not found' }, { status: 404 })
    }

    const ticket = ticketRes.rows[0]

    // 2. Resolve booked services
    const bookedServices = await getServicesForTicket(ticketId, db)
    const totalLaborHours = bookedServices.reduce(
      (sum, s) => sum + (Number(s.base_duration_hours) || 1),
      0
    )

    // 3. Resolve preferred start time (naive ms)
    let preferredStartMs: number
    if (ticket.preferred_datetime) {
      const parsed = parseNaiveTimestamp(ticket.preferred_datetime)
      preferredStartMs = !isNaN(parsed) ? parsed : Date.now()
    } else {
      preferredStartMs = Date.now()
    }

    // 4. Shop hours
    const shopHours = normalizeShopHours(null)

    // 5. Query active mechanics
    const mechanicsRes = await db.query(
      `SELECT id, full_name, email, contact_number, status
       FROM employees
       WHERE role = 'mechanic'
         AND status != 'terminated'
       ORDER BY full_name ASC`
    )
    const mechanics = mechanicsRes.rows

    // 6. Query ongoing tasks from service_progress_tasks
    const tasksRes = await db.query(
      `SELECT 
         spt.id,
         COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) AS mechanic_id,
         spt.task_title,
         spt.task_status,
         COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
         COALESCE(
           spt.estimated_finish,
           spt.scheduled_date + (COALESCE(jos.estimated_hours, 1.5) * INTERVAL '1 hour')
         )::text AS estimated_finish,
         COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours
       FROM service_progress_tasks spt
       JOIN job_orders jo ON jo.id = spt.job_order_id
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
         AND COALESCE(spt.scheduled_date, spt.started_at) >= (NOW() - INTERVAL '2 days')
       ORDER BY scheduled_date ASC`
    )

    // Group busy intervals by mechanic
    const busyIntervalsByMechanic: Record<number, Interval[]> = {}
    for (const m of mechanics) {
      busyIntervalsByMechanic[m.id] = []
    }

    for (const t of tasksRes.rows) {
      const mId = Number(t.mechanic_id)
      if (busyIntervalsByMechanic[mId] && t.scheduled_date) {
        const sMs = parseNaiveTimestamp(t.scheduled_date)
        const finishDateStr = t.estimated_finish || t.scheduled_date
        const eMs = parseNaiveTimestamp(finishDateStr)
        if (!isNaN(sMs) && !isNaN(eMs) && eMs > sMs) {
          busyIntervalsByMechanic[mId].push({ start: sMs, end: eMs })
        }
      }
    }

    // Sort intervals
    for (const mId of Object.keys(busyIntervalsByMechanic)) {
      busyIntervalsByMechanic[Number(mId)].sort((a, b) => a.start - b.start)
    }

    // Helper: Simulate scheduling all booked services sequentially for a mechanic from a given startMs
    function simulateServices(
      mId: number,
      startMs: number
    ): { ok: boolean; slots: SimulatedSlot[]; finalEndMs: number; conflictReason?: string } {
      const mechBusy = busyIntervalsByMechanic[mId] || []
      const simulatedSlots: SimulatedSlot[] = []
      let cursorMs = startMs

      // If no services, 1.5 default
      const servicesToSchedule =
        bookedServices.length > 0
          ? bookedServices
          : [{ id: 0, service_name: 'General Service & Inspection', base_duration_hours: 1.5, base_price: 0 }]

      for (const svc of servicesToSchedule) {
        const hours = Number(svc.base_duration_hours) || 1
        const slot = findEarliestSlotForMechanic(cursorMs, hours, mechBusy, [], shopHours)
        if (!slot) {
          return { ok: false, slots: [], finalEndMs: cursorMs, conflictReason: 'No available shop hours within schedule limit' }
        }

        const dStart = new Date(slot.start)
        const dEnd = new Date(slot.end)

        // Check if lunch break occurs during this slot (between 12 PM and 1 PM)
        const lunchStartHour = SHOP_LUNCH_START_HOUR
        const lunchEndHour = SHOP_LUNCH_END_HOUR
        const spansLunch =
          (dStart.getUTCHours() < lunchStartHour && dEnd.getUTCHours() >= lunchEndHour) ||
          dStart.getUTCHours() === lunchStartHour

        simulatedSlots.push({
          serviceId: svc.id,
          serviceName: svc.service_name,
          durationHours: hours,
          startIso: formatNaiveIso(slot.start),
          endIso: formatNaiveIso(slot.end),
          displayStart: formatNaiveDisplay(slot.start),
          displayEnd: formatNaiveDisplay(slot.end),
          spansLunch,
        })

        cursorMs = slot.end + TASK_GAP_MINUTES * 60 * 1000
      }

      const finalEnd = simulatedSlots.length > 0 ? parseNaiveTimestamp(simulatedSlots[simulatedSlots.length - 1].endIso) : cursorMs
      return { ok: true, slots: simulatedSlots, finalEndMs: finalEnd }
    }

    // 7. Evaluate feasibility per mechanic
    const evaluatedMechanics = []
    let anyMechanicCanStart = false
    let bestEarliestMechanic: {
      mechanicId: number
      mechanicName: string
      suggestedStartIso: string
      suggestedFinishIso: string
      finishMs: number
      timeline: SimulatedSlot[]
    } | null = null

    for (const m of mechanics) {
      if (m.status === 'terminated') {
        continue
      }

      const isOnLeave = m.status === 'on_leave'
      if (isOnLeave) {
        evaluatedMechanics.push({
          id: m.id,
          name: m.full_name,
          email: m.email,
          rank: 'Mechanic',
          status: m.status,
          canAccommodateAtRequestedTime: false,
          conflictReason: 'Mechanic is currently on leave and cannot be assigned.',
          earliestSlot: null,
          timeline: [],
        })
        continue
      }

      // Simulation 1: Attempt to start at preferredStartMs
      const simPreferred = simulateServices(m.id, preferredStartMs)

      // Can accommodate at requested time if the first task starts directly at preferredStartMs (or within step)
      const firstSlot = simPreferred.slots[0]
      const firstSlotStart = firstSlot ? parseNaiveTimestamp(firstSlot.startIso) : null
      const roundedPreferred = roundUpToStepMs(preferredStartMs)
      const canStartDirectly =
        simPreferred.ok &&
        firstSlotStart !== null &&
        !isNaN(firstSlotStart) &&
        Math.abs(firstSlotStart - roundedPreferred) <= 15 * 60 * 1000

      if (canStartDirectly) {
        anyMechanicCanStart = true
      }

      const earliestStartIso = simPreferred.slots[0]?.startIso || formatNaiveIso(preferredStartMs)
      const earliestFinishIso =
        simPreferred.slots[simPreferred.slots.length - 1]?.endIso ||
        formatNaiveIso(simPreferred.finalEndMs)

      // Track global best (earliest finishing mechanic)
      if (
        simPreferred.ok &&
        (!bestEarliestMechanic || simPreferred.finalEndMs < bestEarliestMechanic.finishMs)
      ) {
        bestEarliestMechanic = {
          mechanicId: m.id,
          mechanicName: m.full_name,
          suggestedStartIso: earliestStartIso,
          suggestedFinishIso: earliestFinishIso,
          finishMs: simPreferred.finalEndMs,
          timeline: simPreferred.slots,
        }
      }

      const conflictMsg =
        !simPreferred.ok
          ? simPreferred.conflictReason || 'No availability on this date'
          : firstSlotStart
          ? `Handling existing job orders until ${formatNaiveDisplay(firstSlotStart)}`
          : 'Schedule full'

      evaluatedMechanics.push({
        id: m.id,
        name: m.full_name,
        email: m.email,
        rank: 'Mechanic',
        status: m.status,
        canAccommodateAtRequestedTime: canStartDirectly,
        conflictReason: canStartDirectly ? null : conflictMsg,
        earliestSlot: {
          startIso: earliestStartIso,
          finishIso: earliestFinishIso,
          displayStart: formatNaiveDisplay(firstSlotStart || preferredStartMs),
          displayFinish: formatNaiveDisplay(simPreferred.finalEndMs),
        },
        timeline: simPreferred.slots,
      })
    }

    const allMechanicsBusy = !anyMechanicCanStart

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        customerName: `${ticket.first_name} ${ticket.last_name}`,
        phone: ticket.contact_number,
        vehicle: `${ticket.vehicle_model} ${ticket.vehicle_year}`,
        plate: ticket.plate_number,
        preferredDateTime: ticket.preferred_datetime || null,
        preferredDateDisplay: formatNaiveDisplay(parseNaiveTimestamp(ticket.preferred_datetime || '')),
        totalLaborHours,
        services: bookedServices.map((s) => ({
          id: s.id,
          name: s.service_name,
          durationHours: Number(s.base_duration_hours) || 1,
          price: Number(s.base_price) || 0,
        })),
        assignedMechanicId: ticket.assigned_mechanic_id ? Number(ticket.assigned_mechanic_id) : null,
      },
      allMechanicsBusy,
      recommendedEarliestSlot:
        allMechanicsBusy && bestEarliestMechanic
          ? {
              mechanicId: bestEarliestMechanic.mechanicId,
              mechanicName: bestEarliestMechanic.mechanicName,
              suggestedStartIso: bestEarliestMechanic.suggestedStartIso,
              suggestedFinishIso: bestEarliestMechanic.suggestedFinishIso,
              displayStart: formatNaiveDisplay(parseNaiveTimestamp(bestEarliestMechanic.suggestedStartIso)),
              displayFinish: formatNaiveDisplay(bestEarliestMechanic.finishMs),
              timeline: bestEarliestMechanic.timeline,
              reason: `All active mechanics are busy with other job orders at the requested drop-off time. ${bestEarliestMechanic.mechanicName} can accommodate this job order continuously from start to finish starting from the suggested time.`,
            }
          : null,
      mechanics: evaluatedMechanics,
    })
  } catch (err: any) {
    console.error('Job queue availability error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: err?.message },
      { status: 500 }
    )
  }
}
