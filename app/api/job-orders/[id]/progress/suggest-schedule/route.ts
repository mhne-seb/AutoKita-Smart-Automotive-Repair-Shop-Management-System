import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authGuard'
import { db } from '@/lib/db'
import { ROAD_TEST_TITLE } from '@/data/roadTest'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'
import { DEFAULT_TASK_HOURS } from '@/data/shopPolicy'
import {
  suggestSchedule,
  normalizeShopHours,
  parseNaiveTimestamp,
  formatNaiveIso,
  type Interval,
  type MechanicInput,
  type TaskInput,
} from '@/lib/autoSchedule'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  const { id } = await params
  const jobOrderId = parseInt(id, 10)
  if (Number.isNaN(jobOrderId) || jobOrderId <= 0) {
    return NextResponse.json(
      { success: false, message: 'Invalid job order ID.' },
      { status: 400 },
    )
  }

  try {
    // 1. Load job order
    const joResult = await db.query(
      `SELECT id, status::text, date_arrived::text, assigned_mechanic_id,
              (date_promised AT TIME ZONE 'Asia/Manila')::text AS date_promised
       FROM job_orders
       WHERE id = $1`,
      [jobOrderId],
    )

    if (joResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Job order not found.' },
        { status: 404 },
      )
    }

    const jobOrder = joResult.rows[0]
    if (
      jobOrder.status !== 'in_progress' &&
      jobOrder.status !== 'waiting_on_parts'
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Tasks can be scheduled after the customer approves the quotation.',
        },
        { status: 409 },
      )
    }

    // 2. Load tasks to schedule: section in_progress, pending, not road test/scan
    const tasksResult = await db.query(
      `SELECT 
         spt.id,
         spt.task_title,
         COALESCE(jos.estimated_hours, $2)::numeric AS estimated_hours,
         jos.service_type
       FROM service_progress_tasks spt
       LEFT JOIN LATERAL (
         SELECT jos.estimated_hours, s.service_type::text AS service_type
         FROM services s
         JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
         WHERE s.service_name = spt.task_title
         LIMIT 1
       ) jos ON true
       WHERE spt.job_order_id = $1
         AND spt.section_id = 'in_progress'
         AND spt.task_status = 'pending'
         AND spt.task_title != $3
         AND spt.task_title != $4
       ORDER BY spt.id ASC`,
      [
        jobOrderId,
        DEFAULT_TASK_HOURS,
        ROAD_TEST_TITLE,
        DIAGNOSTIC_SCAN_SERVICE_NAME,
      ],
    )

    // 3. Load parts for this job order to determine blockedBy and partExpected
    const partsResult = await db.query(
      `SELECT 
         p.id,
         p.description,
         p.status::text,
         s.service_name,
         COALESCE(po.expected_delivery_date, p.estimated_delivery_date)::text AS expected_delivery_date
       FROM job_order_parts p
       JOIN job_order_services jos ON jos.id = p.job_order_service_id
       JOIN services s ON s.id = jos.service_id
       LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
       WHERE p.job_order_id = $1
       ORDER BY p.id ASC`,
      [jobOrderId],
    )

    const tasks: TaskInput[] = tasksResult.rows.map((row: any) => {
      const matchingParts = partsResult.rows.filter(
        (p: any) => p.service_name === row.task_title,
      )
      const blockingParts = matchingParts.filter((p: any) =>
        ['to_order', 'ordered', 'in_transit'].includes(p.status),
      )

      let blockedBy: string | null = null
      let partExpected: string | null = null

      if (blockingParts.length > 0) {
        blockedBy = blockingParts[0].description || 'Required part'
        const dates = blockingParts
          .map((p: any) => p.expected_delivery_date)
          .filter((d: any): d is string => Boolean(d))
        if (dates.length > 0) {
          dates.sort((a: string, b: string) => a.localeCompare(b))
          partExpected = dates[dates.length - 1]
        }
      }

      return {
        id: Number(row.id),
        title: row.task_title,
        hours: Number(row.estimated_hours) || DEFAULT_TASK_HOURS,
        blockedBy,
        partExpected,
      }
    })

    const currentTaskIds = tasksResult.rows.map((row: any) => Number(row.id))

    const serviceTypeByTaskId = new Map<number, string | null>(
      tasksResult.rows.map((row: any) => [Number(row.id), row.service_type ?? null]),
    )

    // 4. Load carBusy: other tasks of this car that are scheduled and not completed/cancelled
    const carBusyResult = await db.query(
      `SELECT 
         spt.id,
         COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
         COALESCE(jos.estimated_hours, $2)::numeric AS estimated_hours
       FROM service_progress_tasks spt
       LEFT JOIN LATERAL (
         SELECT jos.estimated_hours
         FROM services s
         JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
         WHERE s.service_name = spt.task_title
         LIMIT 1
       ) jos ON true
       WHERE spt.job_order_id = $1
         AND NOT (spt.id = ANY($3::int[]))
         AND COALESCE(spt.scheduled_date, spt.started_at) IS NOT NULL
         AND spt.task_status NOT IN ('completed', 'cancelled')
       ORDER BY COALESCE(spt.scheduled_date, spt.started_at) ASC`,
      [jobOrderId, DEFAULT_TASK_HOURS, currentTaskIds],
    )

    const carBusy: Interval[] = []
    for (const row of carBusyResult.rows) {
      const start = parseNaiveTimestamp(row.scheduled_date)
      if (!Number.isNaN(start)) {
        const hours = Number(row.estimated_hours) || DEFAULT_TASK_HOURS
        const end = start + Math.round(hours * 3600 * 1000)
        carBusy.push({ start, end })
      }
    }

    // 5. Load active mechanics and their scheduled tasks across all job orders
    const mechanicsResult = await db.query(
      `SELECT id, full_name
       FROM employees
       WHERE role = 'mechanic' AND status = 'active'
       ORDER BY id ASC`,
    )

    const mechanicBusyResult = await db.query(
      `SELECT 
         COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) AS mechanic_id,
         COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
         COALESCE(jos.estimated_hours, $1)::numeric AS estimated_hours
       FROM service_progress_tasks spt
       JOIN job_orders jo ON jo.id = spt.job_order_id
       JOIN employees e ON e.id = COALESCE(spt.mechanic_id, jo.assigned_mechanic_id)
       LEFT JOIN LATERAL (
         SELECT jos.estimated_hours
         FROM services s
         JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
         WHERE s.service_name = spt.task_title
         LIMIT 1
       ) jos ON true
       WHERE e.role = 'mechanic' AND e.status = 'active'
         AND NOT (spt.id = ANY($2::int[]))
         AND COALESCE(spt.scheduled_date, spt.started_at) IS NOT NULL
         AND spt.task_status NOT IN ('completed', 'cancelled')`,
      [DEFAULT_TASK_HOURS, currentTaskIds],
    )

    const busyMap = new Map<number, Interval[]>()
    for (const row of mechanicBusyResult.rows) {
      const mechId = Number(row.mechanic_id)
      const start = parseNaiveTimestamp(row.scheduled_date)
      if (!Number.isNaN(start)) {
        const hours = Number(row.estimated_hours) || DEFAULT_TASK_HOURS
        const end = start + Math.round(hours * 3600 * 1000)
        const list = busyMap.get(mechId) ?? []
        list.push({ start, end })
        busyMap.set(mechId, list)
      }
    }

    const mechanics: MechanicInput[] = mechanicsResult.rows.map((row: any) => ({
      id: Number(row.id),
      name: row.full_name || `Mechanic #${row.id}`,
      busy: busyMap.get(Number(row.id)) ?? [],
    }))

    // 6. Shop hours
    let rawHours: unknown = null
    try {
      const shopRes = await db.query(
        'SELECT operating_hours FROM shops ORDER BY id LIMIT 1',
      )
      rawHours = shopRes.rows[0]?.operating_hours
    } catch {}
    const shopHours = normalizeShopHours(rawHours)

    // 7. First come, first served warning (earlier date_arrived, in_progress, with pending unscheduled task)
    let earlier: Array<{ jobOrderId: number; plate: string; arrived: string }> = []
    if (jobOrder.date_arrived) {
      const earlierResult = await db.query(
        `SELECT DISTINCT
           jo.id AS job_order_id,
           v.plate_number AS plate,
           jo.date_arrived::text AS arrived
         FROM job_orders jo
         JOIN vehicles v ON v.id = jo.vehicle_id
         JOIN service_progress_tasks spt ON spt.job_order_id = jo.id
         WHERE jo.status = 'in_progress'
           AND jo.date_arrived < $1::timestamp
           AND jo.id != $2
           AND spt.section_id = 'in_progress'
           AND spt.task_status = 'pending'
           AND (spt.scheduled_date IS NULL OR spt.mechanic_id IS NULL)
           AND spt.task_title != $3
           AND spt.task_title != $4
           AND NOT EXISTS (
             SELECT 1 FROM job_order_parts jp
             JOIN job_order_services jos2 ON jos2.id = jp.job_order_service_id
             JOIN services s2 ON s2.id = jos2.service_id
             WHERE jp.job_order_id = jo.id AND s2.service_name = spt.task_title
               AND jp.status::text IN ('to_order', 'ordered', 'in_transit')
           )
         ORDER BY jo.date_arrived::text ASC
         LIMIT 5`,
        [
          jobOrder.date_arrived,
          jobOrderId,
          ROAD_TEST_TITLE,
          DIAGNOSTIC_SCAN_SERVICE_NAME,
        ],
      )

      earlier = earlierResult.rows.map((r: any) => ({
        jobOrderId: Number(r.job_order_id),
        plate: r.plate || '—',
        arrived: r.arrived,
      }))
    }

    // 8. Run scheduling
    const now = Date.now() + 8 * 60 * 60 * 1000 // Manila wall-clock as naive UTC
    const { suggestions, promisedDate } = suggestSchedule({
      now,
      hours: shopHours,
      mechanics,
      carBusy,
      tasks,
      preferredMechanicId: jobOrder.assigned_mechanic_id
        ? Number(jobOrder.assigned_mechanic_id)
        : null,
    })

    const planning = {
      nowIso: formatNaiveIso(now),
      shopHours: shopHours as Record<string, string>,
      preferredMechanicId: jobOrder.assigned_mechanic_id
        ? Number(jobOrder.assigned_mechanic_id)
        : null,
      mechanics: mechanics.map((m) => ({
        id: m.id,
        name: m.name,
        busy: m.busy.map((b) => ({
          start: formatNaiveIso(b.start),
          end: formatNaiveIso(b.end),
        })),
      })),
      carBusy: carBusy.map((b) => ({
        start: formatNaiveIso(b.start),
        end: formatNaiveIso(b.end),
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        hours: t.hours,
        blockedBy: t.blockedBy,
        partExpected: t.partExpected,
        serviceType: serviceTypeByTaskId.get(t.id) ?? null,
      })),
    }

    return NextResponse.json({
      success: true,
      suggestions,
      promisedDate,
      alreadyPromised: jobOrder.date_promised || null,
      earlier,
      nothingToSchedule: tasks.length === 0,
      planning,
    })
  } catch (error) {
    console.error('Suggest schedule error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 },
    )
  }
}
