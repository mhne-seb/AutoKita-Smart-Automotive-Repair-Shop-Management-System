import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'
import { notifyCustomer } from '@/lib/customerNotify'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    const { taskId, scheduledDate, status, mechanicId, note } = body

    if (!taskId) {
      return NextResponse.json({ success: false, message: 'Missing taskId' }, { status: 400 })
    }

    // Capacity check — only when this save would ADD a task to a mechanic's
    // plate (a new assignment or a reassignment). Re-saving a task they
    // already hold, or unassigning, never hits the cap. The UI checks this
    // too; this is the guarantee.
    if (mechanicId) {
      const current = await db.query(
        `SELECT mechanic_id FROM service_progress_tasks WHERE id = $1::int AND job_order_id = $2::int`,
        [taskId, jobOrderId],
      )
      const alreadyTheirs = current.rows[0]?.mechanic_id === Number(mechanicId)
      if (!alreadyTheirs) {
        const load = await db.query(
          `SELECT e.full_name AS name, e.status,
                  COALESCE(ep.jobs_capacity, $2)::int AS capacity,
                  (SELECT COUNT(*)::int FROM service_progress_tasks spt
                    WHERE spt.mechanic_id = e.id AND spt.task_status <> 'completed') AS open_tasks
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
        if (m.open_tasks >= m.capacity) {
          return NextResponse.json(
            {
              success: false,
              code: 'MECHANIC_FULL',
              message: `${m.name} already has ${m.open_tasks} open tasks (limit ${m.capacity}). Finish one first or pick another mechanic.`,
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

    // A task can't be started with no mechanic or no schedule. The UI checks
    // this too; this is the guarantee. (The client always sends the task's
    // current date/mechanic along with a status change.)
    if (status === 'in_progress' && (!mechanicId || !scheduledDate)) {
      return NextResponse.json(
        { success: false, code: 'TASK_UNSCHEDULED', message: 'Schedule this task and assign a mechanic before starting it.' },
        { status: 409 },
      )
    }

    // Remember where the task was, so "started" is only announced once.
    const before = await db.query(
      `SELECT task_title, task_status FROM service_progress_tasks WHERE id = $1::int AND job_order_id = $2::int`,
      [taskId, jobOrderId],
    )
    const prev = before.rows[0]

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
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
