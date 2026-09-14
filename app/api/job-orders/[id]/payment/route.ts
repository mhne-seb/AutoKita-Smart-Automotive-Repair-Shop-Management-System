import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Admin-side view of the latest payment submitted for a job order, plus the
// action to verify/reject it. Raw queries straight against `payments` —
// get_payment_records() (sql/Other/run_all_functions.sql) doesn't expose the
// payment_channel/reference_number/proof_of_payment_image columns, and that
// file isn't touched without going through Jubert.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await db.query(
      `SELECT id, payment_method, payment_channel, reference_number, proof_of_payment_image,
              amount_paid, payment_date, verification_status
       FROM payments
       WHERE job_order_id = $1::int
       ORDER BY payment_date DESC
       LIMIT 1`,
      [id],
    )
    return NextResponse.json({ success: true, payment: result.rows[0] ?? null })
  } catch (error) {
    console.error('Payment fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

// PATCH — admin verifies or rejects the latest payment for this job order.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { paymentId, decision } = await request.json()

    if (!paymentId || (decision !== 'verified' && decision !== 'rejected')) {
      return NextResponse.json({ success: false, message: 'paymentId and a valid decision are required' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE payments SET verification_status = $1::payment_verification_status
       WHERE id = $2::int AND job_order_id = $3::int
       RETURNING id`,
      [decision, paymentId, id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 })
    }

    // Money's confirmed — the downpayment policy is satisfied, work can start.
    // (The 2FA path advances immediately in /api/tracking/quotation/confirm,
    // since no payment is involved there.)
    if (decision === 'verified') {
      await db.query(`SELECT advance_job_order_stage($1::int, 'in_progress'::job_orders_status)`, [id])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
