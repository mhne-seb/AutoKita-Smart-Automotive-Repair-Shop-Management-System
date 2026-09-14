import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// The customer's decision on the inspection pre-diagnostic round.
// Approving is what advances the job order to the quotation stage —
// sending it for approval no longer does.
export async function POST(request: NextRequest) {
  try {
    const { userId, jobOrderId, decision, reason } = await request.json()

    if (decision !== 'approved' && decision !== 'disputed') {
      return NextResponse.json({ success: false, message: 'Invalid decision' }, { status: 400 })
    }
    if (!userId || !jobOrderId) {
      return NextResponse.json({ success: false, message: 'Missing userId or jobOrderId' }, { status: 400 })
    }

    // A dispute with no reason is the "oral agreement" the shop is trying to
    // get away from — the mechanic needs something to revise toward.
    const trimmedReason = String(reason ?? '').trim()
    if (decision === 'disputed' && !trimmedReason) {
      return NextResponse.json(
        { success: false, message: 'Please tell us briefly what your concern is.' },
        { status: 400 },
      )
    }

    // Ownership check — a customer may only respond to their own job order.
    const joRes = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
    const jobOrder = joRes.rows[0]
    if (!jobOrder) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }
    if (jobOrder.user_id !== userId) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }

    // The latest round must still be awaiting the customer.
    const latest = await db.query(`SELECT * FROM get_pre_diagnostic($1)`, [jobOrderId])
    const round = latest.rows[0]
    if (!round) {
      return NextResponse.json({ success: false, message: 'Nothing to respond to' }, { status: 404 })
    }
    if (round.customer_approval_status !== 'pending') {
      return NextResponse.json(
        { success: false, message: 'This inspection has already been answered.' },
        { status: 409 },
      )
    }

    await db.query(`SELECT update_pre_diagnostic_approval($1, $2::approval_status)`, [round.id, decision])

    // Record who answered, when, and (for a dispute) why. pre_diagnostics has
    // no column for the customer's reason and only stamps a time on approval,
    // so the audit log carries both — it's the paper trail for the whole
    // back-and-forth. 'approved' / 'rejected' are existing enum values.
    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, $2::audit_action_enum, 'pre_diagnostics', $3, $4, NOW())`,
      [userId, decision === 'approved' ? 'approved' : 'rejected', round.id, trimmedReason || null],
    )

    // Approval moves the job forward. A dispute leaves it in `inspecting` so
    // the shop can revise the findings and re-send.
    if (decision === 'approved') {
      await db.query(
        `SELECT advance_job_order_stage($1, 'pending_customer_approval'::job_orders_status)`,
        [jobOrderId],
      )
    }

    return NextResponse.json({ success: true, decision })
  } catch (err) {
    console.error('[/api/tracking/inspecting/respond] error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}