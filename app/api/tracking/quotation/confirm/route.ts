import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyOtp, QUOTATION_OTP_PURPOSE } from '@/lib/otp'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

// Step 2 of confirming a quotation. The customer picked which services they
// want, typed the emailed code, and this is where it all gets checked:
//   - the OTP must be valid for THIS customer and THIS job order
//   - the job order must belong to them and not already be confirmed
//   - the OBD-II scan fee, if it's on the job order, stays on it — they agreed
//     to that at booking, and unticking it here would undo a recorded consent
// Passing all that is the shop's "documented go signal" (Customer Approval
// Policy), so it's written to the audit log with the customer's id.
export async function POST(request: NextRequest) {
  try {
    const { userId, jobOrderId, acceptedServiceIds, otpToken, otpCode } = await request.json()

    if (!userId || !jobOrderId || !Array.isArray(acceptedServiceIds)) {
      return NextResponse.json(
        { success: false, message: 'userId, jobOrderId and acceptedServiceIds are required' },
        { status: 400 },
      )
    }
    if (!otpToken || !otpCode) {
      return NextResponse.json({ success: false, message: 'Verification code is required' }, { status: 400 })
    }

    const otp = verifyOtp(String(otpToken), String(otpCode), QUOTATION_OTP_PURPOSE, `${userId}:${jobOrderId}`)
    if (!otp.ok) {
      return NextResponse.json(
        {
          success: false,
          code: otp.reason,
          message:
            otp.reason === 'expired'
              ? 'That code has expired. Request a new one.'
              : 'Incorrect code. Please try again.',
        },
        { status: 401 },
      )
    }

    const joRes = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
    const jobOrder = joRes.rows[0]
    if (!jobOrder) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    if (jobOrder.user_id !== userId) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    if (jobOrder.quotation_approved) {
      return NextResponse.json({ success: false, message: 'Quotation already confirmed' }, { status: 409 })
    }

    // The pre-authorized diagnostic fee is not the customer's to remove here.
    const feeRes = await db.query(
      `SELECT jos.id FROM job_order_services jos
       JOIN services s ON s.id = jos.service_id
       WHERE jos.job_order_id = $1 AND s.service_name = $2`,
      [jobOrderId, DIAGNOSTIC_SCAN_SERVICE_NAME],
    )
    const keepIds = new Set<number>(acceptedServiceIds.map(Number))
    for (const r of feeRes.rows) keepIds.add(Number(r.id))
    const finalIds = [...keepIds]

    // Services the customer declined come off the job order. (999999 is the
    // page's pseudo-id for "all parts" — if it's absent, the parts go too.)
    await db.query(
      `DELETE FROM job_order_services WHERE job_order_id = $1 AND id != ALL($2::int[])`,
      [jobOrderId, finalIds],
    )
    if (!keepIds.has(999999)) {
      await db.query(`DELETE FROM job_order_parts WHERE job_order_id = $1`, [jobOrderId])
    }

    await db.query(`SELECT set_quotation_approval($1, $2)`, [jobOrderId, true])

    // The customer's go-signal is the answer to the quotation review round
    // the admin sent — close it as approved so the admin side stops showing
    // "Recall Approval", then move the job onto the floor. No payment is
    // involved on this path, so work can start right away.
    const roundRes = await db.query(`SELECT id, customer_approval_status FROM get_pre_diagnostic($1)`, [jobOrderId])
    const round = roundRes.rows[0]
    if (round?.customer_approval_status === 'pending') {
      await db.query(`SELECT update_pre_diagnostic_approval($1, 'approved'::approval_status)`, [round.id])
    }
    await db.query(`SELECT advance_job_order_stage($1, 'in_progress'::job_orders_status)`, [jobOrderId])

    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'approved'::audit_action_enum, 'job_orders', $2, $3, NOW())`,
      [userId, jobOrderId, JSON.stringify({ event: 'quotation_confirmed_2fa', accepted_service_ids: finalIds })],
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/tracking/quotation/confirm] error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
