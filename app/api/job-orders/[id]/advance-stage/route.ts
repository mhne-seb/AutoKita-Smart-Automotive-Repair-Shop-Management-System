import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Maps our simplified UI stage to the real job_orders_status enum values
// the database function expects.
const STAGE_TO_DB_STATUS: Record<string, string> = {
  inspecting: 'inspecting',
  quotation: 'pending_customer_approval',
  'in-progress': 'in_progress',
  completed: 'completed',
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { stage } = await request.json()

    const dbStatus = STAGE_TO_DB_STATUS[stage]
    if (!dbStatus) {
      return NextResponse.json({ success: false, message: `Unknown stage: ${stage}` }, { status: 400 })
    }

    // advance_job_order_stage() updates the row, stamps the right timestamp,
    // and writes an audit log entry — but returns nothing itself (VOID), so
    // we re-fetch the job order afterward to hand fresh data back to the UI.
    await db.query(`SELECT advance_job_order_stage($1, $2::job_orders_status)`, [id, dbStatus])

    const result = await db.query(`SELECT * FROM get_job_order_detail($1)`, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found after update' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Advance job order stage error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}