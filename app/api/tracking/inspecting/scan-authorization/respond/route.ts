import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { notifyCustomer } from '@/lib/customerNotify'
import { DIAGNOSTIC_SCAN_SERVICE_NAME, DIAGNOSTIC_SCAN_FEE } from '@/data/diagnosticScan'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const userIdRaw = body.userId
  const { authorizationId, approved } = body
  if (!authorizationId || typeof approved !== 'boolean') {
    return NextResponse.json({ success: false, message: 'authorizationId and approved are required' }, { status: 400 })
  }

  const guard = await (userIdRaw ? requireCustomer(userIdRaw) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const a = await client.query(
      `SELECT sa.job_order_id, sa.decision::text, jo.user_id
       FROM scan_authorizations sa JOIN job_orders jo ON jo.id = sa.job_order_id
       WHERE sa.id = $1 FOR UPDATE`,
      [authorizationId],
    )
    const auth = a.rows[0]
    if (!auth) { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'Request not found' }, { status: 404 }) }
    if (auth.user_id !== userId) { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }) }
    if (auth.decision !== 'pending') { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'This request has already been answered.' }, { status: 409 }) }

    const jobOrderId: number = auth.job_order_id

    if (approved) {
      // Same shape as the booking-time consent path (app/api/admin/job-queue/route.ts) —
      // one job_order_services row, billed regardless of what happens to the quotation later.
      await client.query(
        `INSERT INTO job_order_services
           (job_order_id, service_id, description_of_work, estimated_hours, estimated_amount, actual_amount)
         SELECT $1, s.id, $2, s.base_duration_hours, s.base_price, s.base_price
         FROM services s
         WHERE s.service_name = $3 AND s.is_active
         LIMIT 1`,
        [jobOrderId, 'OBD-II diagnostic scan — authorized by customer mid-inspection. Payable even if repairs are declined.', DIAGNOSTIC_SCAN_SERVICE_NAME],
      )
    }

    await client.query(
      `UPDATE scan_authorizations SET decision = $2::approval_status, decided_at = NOW() WHERE id = $1`,
      [authorizationId, approved ? 'approved' : 'disputed'],
    )
    await client.query(
      `INSERT INTO system_audit_logs (action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1::audit_action_enum, 'scan_authorizations', $2, $3, NOW())`,
      [approved ? 'approved' : 'rejected', authorizationId,
       JSON.stringify({ event: approved ? 'scan_authorization_approved' : 'scan_authorization_declined', job_order_id: jobOrderId })],
    )
    await client.query('COMMIT')

    await notifyCustomer({
      jobOrderId,
      entityType: 'scan_authorizations',
      entityId: authorizationId,
      event: approved ? 'scan_authorization_approved' : 'scan_authorization_declined',
      title: approved ? 'Scan Fee Approved' : 'Scan Request Declined',
      message: approved
        ? `You approved the ₱${DIAGNOSTIC_SCAN_FEE.toLocaleString('en-PH')} diagnostic scan fee for Job Order #JO-${jobOrderId}. Our mechanic can now use the scanner.`
        : `You declined the diagnostic scan request for Job Order #JO-${jobOrderId}. Nothing was charged.`,
      sendEmail: false,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Scan authorization response error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
