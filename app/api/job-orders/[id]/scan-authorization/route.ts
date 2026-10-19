import { requireStaff } from '@/lib/authGuard'
import { DIAGNOSTIC_SCAN_SERVICE_NAME, DIAGNOSTIC_SCAN_FEE } from '@/data/diagnosticScan'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLatestScanAuthorization } from '@/lib/scanAuthorization'
import { notifyCustomer } from '@/lib/customerNotify'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  const { id } = await params
  const jobOrderId = Number(id)
  const scanAuth = await getLatestScanAuthorization(jobOrderId)
  return NextResponse.json({ success: true, authorization: scanAuth })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

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
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 },
    )
  }
}

// Removes the OBD-II scan fee from a job order, for a car that has no scanner port.
// This is the ONLY way the fee is removed: the quotation save skips it on purpose.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  const { id } = await params
  const jobOrderId = Number(id)
  if (!Number.isInteger(jobOrderId) || jobOrderId <= 0) {
    return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
  }

  const client = await db.connect()
  let removed = false
  try {
    await client.query('BEGIN')
    const refuse = async (status: number, message: string) => {
      await client.query('ROLLBACK')
      return NextResponse.json({ success: false, message }, { status })
    }

    // Lock the job order so a payment or another save cannot slip in between the checks and the delete.
    // Also read where the quotation stands: the latest approval round, same as get_pre_diagnostic().
    const jo = await client.query(
      `SELECT jo.quotation_approved,
              (SELECT pd.customer_approval_status::text
                 FROM pre_diagnostics pd
                 JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
                WHERE vi.job_order_id = jo.id
                ORDER BY pd.datetime_created DESC
                LIMIT 1) AS latest_round
         FROM job_orders jo
        WHERE jo.id = $1
        FOR UPDATE OF jo`,
      [jobOrderId],
    )
    if (jo.rows.length === 0) return await refuse(404, 'Job order not found')

    // Same rule as the Quotation screen: the fee can only be removed before the quotation is sent.
    if (jo.rows[0].quotation_approved) {
      return await refuse(409, "The customer already approved this quotation, so the scan fee can't be removed.")
    }
    if (jo.rows[0].latest_round === 'pending') {
      return await refuse(409, 'The quotation is waiting for the customer. Recall it first, then remove the scan fee.')
    }

    const line = await client.query(
      `SELECT jos.id
         FROM job_order_services jos
         JOIN services s ON s.id = jos.service_id
        WHERE jos.job_order_id = $1 AND s.service_name = $2`,
      [jobOrderId, DIAGNOSTIC_SCAN_SERVICE_NAME],
    )
    const lineIds: number[] = line.rows.map((r) => Number(r.id))

    if (lineIds.length > 0) {
      // Rule 2: an attached scanner report means the scan was done.
      const report = await client.query(
        `SELECT 1 FROM obd2_diagnostic_reports WHERE job_order_id = $1 LIMIT 1`,
        [jobOrderId],
      )
      if (report.rows.length > 0) {
        return await refuse(409, 'A scanner report is attached. Detach it first if the scan was not done.')
      }

      // Rule 4: a scan voucher already lowered this fee.
      const voucher = await client.query(
        `SELECT 1 FROM retention_offers
          WHERE claimed_on_job_order_id = $1 AND is_claimed = true AND rule_key = 'SCAN10' LIMIT 1`,
        [jobOrderId],
      )
      if (voucher.rows.length > 0) {
        return await refuse(409, "A voucher was already used on this scan. The scan fee can't be removed.")
      }

      // Rule 1: the fee and its "scan finished" task go together.
      await client.query(`DELETE FROM job_order_parts WHERE job_order_service_id = ANY($1::int[])`, [lineIds])
      await client.query(`DELETE FROM job_order_services WHERE id = ANY($1::int[])`, [lineIds])
      await client.query(
        `DELETE FROM service_progress_tasks WHERE job_order_id = $1 AND task_title = $2`,
        [jobOrderId, DIAGNOSTIC_SCAN_SERVICE_NAME],
      )

      // Rule 3: what is left on the bill must still be at least what the customer has paid or submitted.
      // Same sums as src/lib/jobOrderBill.ts.
      const sums = await client.query(
        `SELECT
           (SELECT COALESCE(SUM(actual_amount), 0) FROM job_order_services WHERE job_order_id = $1)
         + (SELECT COALESCE(SUM(total_retail_amount), 0) FROM job_order_parts WHERE job_order_id = $1) AS total,
           (SELECT COALESCE(SUM(amount_paid), 0) FROM payments
             WHERE job_order_id = $1 AND verification_status IN ('verified', 'pending')) AS paid`,
        [jobOrderId],
      )
      if (Number(sums.rows[0].paid) > Number(sums.rows[0].total)) {
        return await refuse(409, "The customer has already paid for this. The scan fee can't be removed.")
      }
      removed = true
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Scan fee removal error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  } finally {
    client.release()
  }

  // Rules 5 and 6: one row in system_audit_logs records who removed it and when, and it is the
  // customer's notification (plus the email). Done after the commit, so a mail problem cannot undo the removal.
  if (removed) {
    try {
      await notifyCustomer({
        jobOrderId,
        entityType: 'job_orders',
        entityId: jobOrderId,
        event: 'scan_fee_removed',
        title: 'Scan fee removed',
        message: `The ₱${DIAGNOSTIC_SCAN_FEE.toLocaleString('en-PH')} scan fee was removed because your car has no scanner port.`,
        employeeId: auth.session.userId,
      })
    } catch (err) {
      console.error('Scan fee removal: notification failed:', err)
    }
  }

  return NextResponse.json({ success: true, removed })
}
