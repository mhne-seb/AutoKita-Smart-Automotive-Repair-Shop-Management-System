import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'
import { notifyCustomer } from '@/lib/customerNotify'
import { ROAD_TEST_TITLE } from '@/data/roadTest'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    const { taskId, scheduledDate, status, mechanicId, note } = body

    if (!taskId) {
      return NextResponse.json({ success: false, message: 'Missing taskId' }, { status: 400 })
    }

    // Capacity check — only when this save would ADD an ongoing job order to a mechanic's
    // plate. Re-saving a task they already hold, or adding another task on a job order
    // they are already handling, never hits the cap.
    if (mechanicId) {
      const current = await db.query(
        `SELECT mechanic_id FROM service_progress_tasks WHERE id = $1::int AND job_order_id = $2::int`,
        [taskId, jobOrderId],
      )
      const alreadyTheirs = current.rows[0]?.mechanic_id === Number(mechanicId)
      if (!alreadyTheirs) {
        // Check if mechanic is already handling this job order through another task or direct assignment
        const alreadyOnThisJobOrder = await db.query(
          `SELECT 1 FROM job_orders jo 
           WHERE jo.id = $1::int 
             AND (jo.assigned_mechanic_id = $2::int OR EXISTS (
               SELECT 1 FROM service_progress_tasks spt 
               WHERE spt.job_order_id = jo.id AND spt.mechanic_id = $2::int
             ))`,
          [jobOrderId, mechanicId]
        )
        const isNewJobOrderForMechanic = alreadyOnThisJobOrder.rowCount === 0

        const load = await db.query(
          `SELECT e.full_name AS name, e.status,
                  COALESCE(ep.jobs_capacity, $2)::int AS capacity,
                  (SELECT COUNT(DISTINCT jo.id)::int
                   FROM job_orders jo
                   LEFT JOIN service_progress_tasks spt ON spt.job_order_id = jo.id
                   WHERE (jo.assigned_mechanic_id = e.id OR spt.mechanic_id = e.id)
                     AND jo.status IN ('in_progress', 'waiting_on_parts', 'testing')
                     AND (spt.task_status IS NULL OR spt.task_status <> 'completed')) AS open_tasks
           FROM employees e
           LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
           WHERE e.id = $1::int`,
          [mechanicId, DEFAULT_MECHANIC_CAPACITY],
        )
        const m = load.rows[0]
        if (!m || m.status !== 'active') {
          return NextResponse.json(
            { success: false, code: 'MECHANIC_UNAVAILABLE', message: `${m?.name ?? 'This mechanic'} is not available for assignment right now.` },
            { status: 409 },
          )
        }
        if (isNewJobOrderForMechanic && m.open_tasks >= m.capacity) {
          return NextResponse.json(
            {
              success: false,
              code: 'MECHANIC_FULL',
              message: `${m.name} is currently handling ${m.open_tasks} ongoing job orders (capacity limit: ${m.capacity}). Finish an ongoing job order first or choose another mechanic.`,
            },
            { status: 409 },
          )
        }
      }
    }

    // Finishing goes through /tasks/[taskId]/finish, which requires the
    // photo of the finished work. Refusing it here is what makes that rule
    // a rule rather than a suggestion.
    if (status === 'completed') {
      return NextResponse.json(
        { success: false, code: 'PHOTO_REQUIRED', message: 'A task is finished by uploading a photo of the completed work.' },
        { status: 409 },
      )
    }

    const before = await db.query(
      `SELECT task_title, task_status FROM service_progress_tasks WHERE id = $1::int AND job_order_id = $2::int`,
      [taskId, jobOrderId],
    )
    const prev = before.rows[0]
    const isRoadTest = prev?.task_title === ROAD_TEST_TITLE
    // The scan already happened during inspection, so like the road test,
    // it has nothing to schedule — it can start without a date/mechanic.
    const isDiagnosticScan = prev?.task_title === DIAGNOSTIC_SCAN_SERVICE_NAME
    // (The road test is the final quality gate, not a scheduled service —
    // it can start as soon as every service is done.)
    if (status === 'in_progress' && !isRoadTest && !isDiagnosticScan && (!mechanicId || !scheduledDate)) {
      return NextResponse.json(
        { success: false, code: 'TASK_UNSCHEDULED', message: 'Schedule this task and assign a mechanic before starting it.' },
        { status: 409 },
      )
    }

    const isReverting = status === 'pending' && prev?.task_status === 'in_progress'

    // Scheduling conflict validation: prevent tasks from overlapping or being scheduled too close (< 15 mins buffer)
    if (!isReverting && !isRoadTest && !isDiagnosticScan && scheduledDate) {
      // 1. Get estimated duration for this task
      const thisTaskEst = await db.query(
        `SELECT COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours
         FROM service_progress_tasks spt
         LEFT JOIN LATERAL (
           SELECT jos.estimated_hours
           FROM services s
           JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
           WHERE s.service_name = spt.task_title
           LIMIT 1
         ) jos ON true
         WHERE spt.id = $1::int`,
        [taskId]
      )
      const thisDurationHours = Number(thisTaskEst.rows[0]?.estimated_hours || 1.5)
      const proposedStart = new Date(scheduledDate).getTime()
      const proposedFinish = proposedStart + (thisDurationHours * 3600 * 1000)

      // 2. Query any active tasks that could conflict (same mechanic or same job order/vehicle)
      const conflicts = await db.query(
        `SELECT spt.id, spt.task_title, spt.scheduled_date, spt.mechanic_id, spt.job_order_id,
                COALESCE(
                  spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'),
                  spt.scheduled_date + INTERVAL '1.5 hours'
                ) AS estimated_finish,
                COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours,
                e.full_name AS mechanic_name
         FROM service_progress_tasks spt
         LEFT JOIN employees e ON e.id = spt.mechanic_id
         LEFT JOIN LATERAL (
           SELECT jos.estimated_hours
           FROM services s
           JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
           WHERE s.service_name = spt.task_title
           LIMIT 1
         ) jos ON true
         WHERE spt.id != $1::int
           AND spt.task_status NOT IN ('completed', 'cancelled')
           AND spt.scheduled_date IS NOT NULL
           AND (
             ($2::int IS NOT NULL AND spt.mechanic_id = $2::int)
             OR spt.job_order_id = $3::int
           )`,
        [taskId, mechanicId ? Number(mechanicId) : null, jobOrderId]
      )

      const BUFFER_MS = 15 * 60 * 1000 // 15-minute buffer

      for (const row of conflicts.rows) {
        const tStart = new Date(row.scheduled_date).getTime()
        const tFinish = row.estimated_finish
          ? new Date(row.estimated_finish).getTime()
          : tStart + Number(row.estimated_hours || 1.5) * 3600 * 1000

        const overlaps = (proposedStart < tFinish) && (proposedFinish > tStart)
        const tooClose = (proposedStart < tFinish + BUFFER_MS) && (proposedFinish + BUFFER_MS > tStart)

        if (tooClose) {
          const isSameMechanic = mechanicId && Number(row.mechanic_id) === Number(mechanicId)
          const startStr = new Date(tStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const finishStr = new Date(tFinish).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          const subject = isSameMechanic ? (row.mechanic_name || 'The assigned mechanic') : 'This vehicle'
          const relation = overlaps ? 'is already scheduled for' : 'is finishing'

          return NextResponse.json(
            {
              success: false,
              code: 'SCHEDULE_CONFLICT',
              message: `Scheduling conflict: ${subject} ${relation} "${row.task_title}" (${startStr} – ${finishStr}). Services cannot overlap and require at least 15 minutes buffer between tasks.`,
            },
            { status: 409 }
          )
        }
      }
    }

    // Call the database function to update the task and the job order's scheduled_date
    await db.query(
      `SELECT schedule_service_task_with_status($1, $2, $3, $4, $5)`,
      [
        taskId, 
        scheduledDate ? scheduledDate : null, 
        status ?? 'pending', 
        mechanicId !== undefined ? (mechanicId || null) : null,
        note !== undefined ? (note === '' ? null : note) : null
      ]
    )

    // Also update the job order's assigned_mechanic_id if assigned
    if (mechanicId) {
      await db.query(
        `UPDATE job_orders 
         SET assigned_mechanic_id = COALESCE(assigned_mechanic_id, $1::int)
         WHERE id = $2::int`,
        [Number(mechanicId), Number(jobOrderId)]
      )
    }

    // The customer hears when work on a service actually begins.
    if (status === 'in_progress' && prev && prev.task_status !== 'in_progress') {
      await notifyCustomer({
        jobOrderId: Number(jobOrderId),
        entityType: 'service_progress_tasks',
        entityId: Number(taskId),
        event: 'task_started',
        title: 'Service Started',
        message: `Work on ${prev.task_title} has started on your vehicle (Job Order #JO-${jobOrderId}).`,
        employeeId: mechanicId ? Number(mechanicId) : null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task scheduling error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}
