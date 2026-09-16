import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    const { taskId, scheduledDate, status, mechanicId, note } = body

    if (!taskId) {
      return NextResponse.json({ success: false, message: 'Missing taskId' }, { status: 400 })
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Task scheduling error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
