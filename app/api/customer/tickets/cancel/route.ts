import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userIdRaw = body.userId
    const ticketId = body.ticketId

    if (!ticketId) {
      return NextResponse.json({ success: false, message: 'Missing ticketId' }, { status: 400 })
    }

    const guard = await (userIdRaw ? requireCustomer(Number(userIdRaw)) : requireCustomer())
    if (!guard.ok) return guard.response
    const userId = guard.session.userId

    // All three guards live in the WHERE clause so there's no window between
    // checking and updating: must be this customer's ticket, must still be
    // waiting on the shop, and must not have become a job order yet.
    const result = await db.query(
      `UPDATE service_tickets
       SET ticket_status = 'cancelled'
       WHERE id = $1
         AND user_id = $2
         AND ticket_status IN ('pending', 'queued', 'inspection_scheduled')
         AND NOT EXISTS (SELECT 1 FROM job_orders jo WHERE jo.ticket_id = service_tickets.id)
       RETURNING id`,
      [ticketId, userId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'This booking can no longer be cancelled here. Please contact the shop.',
        },
        { status: 409 },
      )
    }

    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'status_changed'::audit_action_enum, 'service_tickets', $2, 'cancelled by customer', NOW())`,
      [userId, ticketId],
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/customer/tickets/cancel] error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
