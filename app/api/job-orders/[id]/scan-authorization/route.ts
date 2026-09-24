import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLatestScanAuthorization } from '@/lib/scanAuthorization'
import { notifyCustomer } from '@/lib/customerNotify'

// Admin side of mid-inspection OBD-II scan consent (see
// sql/Other/migration_add_scan_authorizations.sql). Only reachable when the
// job order wasn't already authorized at booking — see
// diagnosticScanAuthorized on GET /api/job-orders/[id]/inspection.
//
//   GET  -> the latest request (pending / approved / disputed), if any.
//   POST -> raise a new one. Just asks — no code needed to ASK, only to
//           approve. Refused if one is already pending, same rule as
//           pull-out requests.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const auth = await getLatestScanAuthorization(jobOrderId)
  return NextResponse.json({ success: true, authorization: auth })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const body = await request.json().catch(() => ({}))
  const note = String(body.note ?? '').trim()

  try {
    const jo = await db.query(`SELECT status::text, user_id FROM job_orders WHERE id = $1`, [jobOrderId])
    if (jo.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    const existing = await getLatestScanAuthorization(jobOrderId)
    if (existing?.decision === 'pending') {
      return NextResponse.json({ success: false, message: 'A scan request is already waiting on the customer.' }, { status: 409 })
    }

    const inserted = await db.query(
      `INSERT INTO scan_authorizations (job_order_id, admin_note) VALUES ($1, $2) RETURNING id`,
      [jobOrderId, note || null],
    )
    const authId = inserted.rows[0].id

    await notifyCustomer({
      jobOrderId,
      entityType: 'scan_authorizations',
      entityId: authId,
      event: 'scan_authorization_requested',
      title: 'Scanner Fee Approval Needed',
      message: `We'd like to run a diagnostic scan on JO-${jobOrderId} — ₱1,500. Please approve on your tracking page.${note ? ` Note: ${note}` : ''}`,
    })

    return NextResponse.json({ success: true, id: authId })
  } catch (error) {
    console.error('Scan authorization request error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
