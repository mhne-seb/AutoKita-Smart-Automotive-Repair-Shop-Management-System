import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Lets a customer withdraw a booking the shop has accepted but not started.
//
// "Not started" is the whole rule: no walkaround photos, no findings, no
// report sent. Once any of those exist the mechanic has put time in — and
// once the scanner has been used there's a fee — so from that point the
// customer has to talk to the shop, and the quotation flow handles what they
// owe. Cancelling here is free precisely because nothing has happened yet.
export async function POST(request: NextRequest) {
  try {
    const { userId, jobOrderId } = await request.json()

    if (!userId || !jobOrderId) {
      return NextResponse.json({ success: false, message: 'Missing userId or jobOrderId' }, { status: 400 })
    }

    // Every condition sits in the WHERE clause so the check and the cancel are
    // one atomic statement — a photo uploaded a millisecond earlier makes this
    // match zero rows instead of cancelling a job that just got work done.
    const result = await db.query(
      `UPDATE job_orders jo
       SET status = 'cancelled'
       WHERE jo.id = $1
         AND jo.user_id = $2
         AND jo.status = 'inspecting'
         AND NOT EXISTS (SELECT 1 FROM vehicle_inspections vi WHERE vi.job_order_id = jo.id)
         AND NOT EXISTS (SELECT 1 FROM pre_diagnostics pd WHERE pd.job_order_id = jo.id)
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
