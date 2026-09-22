import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyCustomer } from '@/lib/customerNotify'

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
       RETURNING id, amount_paid, payment_channel, payment_method::text`,
      [decision, paymentId, id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 })
    }

    // A verified DOWNPAYMENT starts the work. A verified final-balance
    // payment on a completed job changes nothing about the stage — the car is
    // done either way; "released" is the admin's separate hand-over step.
    // (The 2FA path advances immediately in /api/tracking/quotation/confirm,
    // since no payment is involved there.)
    if (decision === 'verified') {
      await db.query(
        `SELECT advance_job_order_stage($1::int, 'in_progress'::job_orders_status)
         WHERE (SELECT status FROM job_orders WHERE id = $1::int) = 'pending_customer_approval'`,
        [id],
      )
    }

    const row = result.rows[0]
    const amount = `₱${Number(row.amount_paid ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    const cash = row.payment_method === 'cash'
    // Cash: "verified" means the shop received it; "rejected" means the
    // customer never paid at the counter. Transfers: matched / not matched.
    await notifyCustomer({
      jobOrderId: Number(id), entityType: 'payments', entityId: Number(paymentId),
      event: decision === 'verified' ? 'payment_verified' : 'payment_rejected',
      title: decision === 'verified' ? (cash ? 'Payment Received' : 'Payment Verified') : (cash ? 'Cash Payment Not Recorded' : 'Payment Not Accepted'),
      message: decision === 'verified'
        ? cash
          ? `We received your cash payment of ${amount} at the counter for Job Order #JO-${id}. Thank you!`
          : `Your payment of ${amount}${row.payment_channel ? ` via ${row.payment_channel}` : ''} for Job Order #JO-${id} has been verified. Thank you!`
        : cash
          ? `Your counter payment of ${amount} for Job Order #JO-${id} wasn't received. You can pay at the shop or choose bank / e-wallet on your Billing page.`
          : `We couldn't match your payment of ${amount} for Job Order #JO-${id} against our records. Please check the reference number and resubmit, or call the shop.`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Payment verification error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
