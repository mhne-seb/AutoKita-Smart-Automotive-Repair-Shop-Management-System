import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userIdRaw = body.userId
    const jobOrderId = body.jobOrderId

    if (!jobOrderId) {
      return NextResponse.json({ success: false, message: 'Missing jobOrderId' }, { status: 400 })
    }

    const guard = await (userIdRaw ? requireCustomer(Number(userIdRaw)) : requireCustomer())
    if (!guard.ok) return guard.response
    const userId = guard.session.userId

    // Every condition sits in the WHERE clause so the check and the cancel are
    // one atomic statement — a photo uploaded a millisecond earlier makes this
    // match zero rows instead of cancelling a job that just got work done.
    const result = await db.query(
      `UPDATE job_orders jo
       SET status = 'cancelled'
       WHERE jo.id = $1
         AND jo.user_id = $2
         AND jo.status = 'inspecting'
         AND NOT EXISTS (
           SELECT 1 FROM vehicle_inspections vi
           WHERE vi.job_order_id = jo.id
             AND (
               EXISTS (SELECT 1 FROM inspection_photos ip WHERE ip.inspection_id = vi.id)
               OR EXISTS (SELECT 1 FROM pre_diagnostics pd WHERE pd.inspection_id = vi.id)
             )
         )
       RETURNING jo.id, jo.ticket_id`,
      [jobOrderId, userId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'This booking can no longer be cancelled online because work has started. Please contact the shop.',
        },
        { status: 409 },
      )
    }

    const { ticket_id } = result.rows[0]

    // Same audit row advance_job_order_stage() writes, so it shows up in the
    // customer's activity feed like any other status change.
    await db.query(
      `INSERT INTO system_audit_logs
         (user_id, action_performed, entity_type, entity_id, old_values, new_values, action_date)
       VALUES ($1, 'status_changed'::audit_action_enum, 'job_orders', $2,
               '{"status":"inspecting"}', '{"status":"cancelled"}', NOW())`,
      [userId, jobOrderId],
    )

    // The booking itself is cancelled too, so the admin queue reflects it.
    if (ticket_id) {
      await db.query(`UPDATE service_tickets SET ticket_status = 'cancelled' WHERE id = $1`, [ticket_id])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/customer/job-orders/cancel] error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
