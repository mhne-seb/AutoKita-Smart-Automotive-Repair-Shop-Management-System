import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    const { taskId, scheduledDate, status } = body

    if (!taskId) {
      return NextResponse.json({ success: false, message: 'Missing taskId' }, { status: 400 })
    }

    // Call the database function to update the task and the job order's date_promised
    await db.query(
      `SELECT schedule_service_task_with_status($1, $2, $3)`,
      [taskId, scheduledDate ? new Date(scheduledDate).toISOString() : null, status ?? 'pending']
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
