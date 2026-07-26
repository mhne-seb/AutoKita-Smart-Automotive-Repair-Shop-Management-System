import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const STAGE_TO_DB_STATUS: Record<string, string> = {
  inspecting: 'inspecting',
  quotation: 'pending_customer_approval',
  'in-progress': 'in_progress',
  completed: 'completed',
}

// Simulates the customer's decision on the latest pre-diagnostic round.
// This stands in for the real Customer-portal approval button, since
// building that page isn't part of this task — only the Admin-side
// buttons need to actually persist the result.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status, advanceToStage } = await request.json()

    if (status !== 'approved' && status !== 'disputed') {
      return NextResponse.json({ success: false, message: `Invalid status: ${status}` }, { status: 400 })
    }

    const latest = await db.query(`SELECT * FROM get_pre_diagnostic($1)`, [id])
    if (latest.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'No pre-diagnostic round found for this job order' }, { status: 404 })
    }
    const preDiagnosticId = latest.rows[0].id

    await db.query(`SELECT update_pre_diagnostic_approval($1, $2::approval_status)`, [preDiagnosticId, status])

    // Only move the job order's real status forward if the caller asked for
    // it (e.g. approving the final quotation moves the job into in_progress;
    // approving the initial inspection round does not need to move anything,
    // since the job order was already placed in "pending_customer_approval"
    // when it was sent).
    if (advanceToStage) {
      const dbStatus = STAGE_TO_DB_STATUS[advanceToStage]
      if (dbStatus) {
        await db.query(`SELECT advance_job_order_stage($1, $2::job_orders_status)`, [id, dbStatus])
      }
    }

    const updated = await db.query(`SELECT * FROM get_pre_diagnostic($1)`, [id])

    return NextResponse.json({ success: true, data: updated.rows[0] })
  } catch (error) {
    console.error('Pre-diagnostic response error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}