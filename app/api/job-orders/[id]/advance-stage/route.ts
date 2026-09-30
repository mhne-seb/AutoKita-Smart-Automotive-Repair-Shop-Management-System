import { requireStaff } from '@/lib/authGuard'
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
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { id } = await params
    const { stage } = await request.json()

    const dbStatus = STAGE_TO_DB_STATUS[stage]
    if (!dbStatus) {
      return NextResponse.json({ success: false, message: `Unknown stage: ${stage}` }, { status: 400 })
    }

    const currentRes = await db.query(`SELECT status::text, quotation_approved FROM job_orders WHERE id = $1`, [id])
    if (currentRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }
    const { status: currentStatus, quotation_approved: quotationApproved } = currentRes.rows[0]

    if (dbStatus === currentStatus) {
      const result = await db.query(`SELECT * FROM get_job_order_detail($1)`, [id])
      return NextResponse.json({ success: true, data: result.rows[0] })
    }

    let allowed = false

    if (currentStatus === 'inspecting' && dbStatus === 'pending_customer_approval') {
      allowed = true
    } else if ((currentStatus === 'inspecting' || currentStatus === 'pending_customer_approval') && dbStatus === 'in_progress') {
      if (!quotationApproved) {
        return NextResponse.json({ success: false, message: 'The customer has not approved the quotation yet.' }, { status: 409 })
      }
      allowed = true
    } else if ((currentStatus === 'in_progress' || currentStatus === 'waiting_on_parts') && dbStatus === 'completed') {
      const openTasksRes = await db.query(`SELECT 1 FROM service_progress_tasks WHERE job_order_id = $1 AND task_status NOT IN ('completed','cancelled') LIMIT 1`, [id])
      if (openTasksRes.rows.length > 0) {
        return NextResponse.json({ success: false, message: 'Some tasks are not finished yet.' }, { status: 409 })
      }
      allowed = true
    }

    if (!allowed) {
      const toPlain = (s: string) => s.replace(/_/g, ' ')
      return NextResponse.json({ success: false, message: `This job order can't move from ${toPlain(currentStatus)} to ${toPlain(dbStatus)}.` }, { status: 409 })
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
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}