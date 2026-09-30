import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyCustomer } from '@/lib/customerNotify'
import { signFileUrl } from '@/lib/storage'

// Admin-side view of the latest payment submitted for a job order, plus the
// action to verify/reject it. Raw queries straight against `payments` —
// get_payment_records() (sql/Other/run_all_functions.sql) doesn't expose the
// payment_channel/reference_number/proof_of_payment_image columns, and that
// file isn't touched without going through Jubert.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

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
    const payment = result.rows[0] ?? null
    if (payment) payment.proof_of_payment_image = await signFileUrl(payment.proof_of_payment_image)
    return NextResponse.json({ success: true, payment })
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
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { id } = await params
    const { paymentId, decision, reason } = await request.json()

    if (!paymentId || (decision !== 'verified' && decision !== 'rejected')) {
      return NextResponse.json({ success: false, message: 'paymentId and a valid decision are required' }, { status: 400 })
    }

    if (decision === 'rejected') {
      const reasonText = String(reason ?? '').trim()
      if (reasonText.length < 3 || reasonText.length > 200) {
        return NextResponse.json({ success: false, message: 'A rejection reason between 3 and 200 characters is required' }, { status: 400 })
      }
    }

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      const payRes = await client.query(
        `SELECT id, verification_status, quotation_selection, amount_paid, payment_channel, payment_method::text
         FROM payments WHERE id = $1::int AND job_order_id = $2::int FOR UPDATE`,
        [paymentId, id],
      )

      if (payRes.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ success: false, message: 'Payment not found' }, { status: 404 })
      }

      const row = payRes.rows[0]
      if (row.verification_status !== 'pending') {
        await client.query('ROLLBACK')
        return NextResponse.json({ success: false, message: 'Payment is not pending' }, { status: 409 })
      }

      const joRes = await client.query(`SELECT quotation_approved FROM job_orders WHERE id = $1::int FOR UPDATE`, [id])
      const jo = joRes.rows[0]

      const isQuotationPayment = row.quotation_selection && !jo.quotation_approved

      if (decision === 'verified' && isQuotationPayment) {
        const selection = row.quotation_selection
        const acceptedServiceIds = selection.acceptedServiceIds || []
        const declinedServiceIds = selection.declinedServiceIds || []

        const curRes = await client.query(
          `SELECT jos.id, jos.service_id, s.service_name
           FROM job_order_services jos
           JOIN services s ON s.id = jos.service_id
           WHERE jos.job_order_id = $1::int`,
          [id],
        )
        const currentServices = curRes.rows

        const feeServiceIds = new Set(
          currentServices
            .filter((s) => s.service_name === 'OBD-II Diagnostic Scan')
            .map((s) => Number(s.id)),
        )

        const acceptedSet = new Set<number>(acceptedServiceIds.map(Number))
        const declinedSet = new Set<number>(Array.isArray(declinedServiceIds) ? declinedServiceIds.map(Number) : [])

        const customerAcceptedAll =
          (Array.isArray(declinedServiceIds) && declinedServiceIds.length === 0) ||
          (declinedSet.size === 0 && acceptedSet.size >= currentServices.length)

        let idsToDelete: number[] = []

        if (!customerAcceptedAll && currentServices.length > 0) {
          const currentIds = currentServices.map((s) => Number(s.id))
          const hasDeclinedOverlap = currentIds.some((id_1) => declinedSet.has(id_1))
          const hasAcceptedOverlap = currentIds.some((id_1) => acceptedSet.has(id_1))

          if (hasDeclinedOverlap) {
            idsToDelete = currentIds.filter((id_1) => declinedSet.has(id_1) && !feeServiceIds.has(id_1))
          } else if (hasAcceptedOverlap) {
            idsToDelete = currentIds.filter((id_1) => !acceptedSet.has(id_1) && !feeServiceIds.has(id_1))
          } else {
            console.warn(
              `[/api/job-orders/[id]/payment] Warning: ID desynchronization detected for JO-${id}. Client IDs: [${acceptedServiceIds}], Current IDs: [${currentIds}]. Skipping deletion to prevent data loss.`,
            )
          }
        }

        if (idsToDelete.length > 0) {
          await client.query(
            `DELETE FROM job_order_parts
             WHERE job_order_id = $1::int AND job_order_service_id IS NOT NULL AND job_order_service_id = ANY($2::int[])`,
            [id, idsToDelete],
          )
          await client.query(
            `DELETE FROM job_order_services WHERE job_order_id = $1::int AND id = ANY($2::int[])`,
            [id, idsToDelete],
          )
        }

        await client.query(`SELECT set_quotation_approval($1::int, $2)`, [id, true])

        const roundRes = await client.query(`SELECT id, customer_approval_status FROM get_pre_diagnostic($1::int)`, [id])
        const round = roundRes.rows[0]
        if (round?.customer_approval_status === 'pending') {
          await client.query(`SELECT update_pre_diagnostic_approval($1::int, 'approved'::approval_status)`, [round.id])
        }

        await client.query(
          `SELECT advance_job_order_stage($1::int, 'in_progress'::job_orders_status)
           WHERE (SELECT status FROM job_orders WHERE id = $1::int) = 'pending_customer_approval'`,
          [id],
        )
      } else if (decision === 'verified') {
        // Final balance payment: just advance stage if applicable
        await client.query(
          `SELECT advance_job_order_stage($1::int, 'in_progress'::job_orders_status)
           WHERE (SELECT status FROM job_orders WHERE id = $1::int) = 'pending_customer_approval'`,
          [id],
        )
      }

      await client.query(
        `UPDATE payments SET verification_status = $1::payment_verification_status, verified_by = $2, verified_at = NOW(), rejection_reason = $3
         WHERE id = $4::int`,
        [decision, auth.session.userId, decision === 'rejected' ? String(reason ?? '').trim() : null, paymentId],
      )

      await client.query('COMMIT')

      const amount = `₱${Number(row.amount_paid ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
      const cash = row.payment_method === 'cash'
      const reasonText = decision === 'rejected' ? String(reason ?? '').trim() : ''

      await notifyCustomer({
        jobOrderId: Number(id), entityType: 'payments', entityId: Number(paymentId),
        event: decision === 'verified' ? 'payment_verified' : 'payment_rejected',
        title: decision === 'verified' ? (cash ? 'Payment Received' : 'Payment Verified') : (cash ? 'Cash Payment Not Recorded' : 'Payment Not Accepted'),
        message: decision === 'verified'
          ? cash
            ? `We received your cash payment of ${amount} at the counter for Job Order #JO-${id}. Thank you!`
            : `Your payment of ${amount}${row.payment_channel ? ` via ${row.payment_channel}` : ''} for Job Order #JO-${id} has been verified. Thank you!`
          : cash
            ? `Your counter payment of ${amount} for Job Order #JO-${id} wasn't received. Reason: ${reasonText}. You can pay at the shop or choose bank / e-wallet on your Billing page.`
            : `We couldn't accept your payment of ${amount} for Job Order #JO-${id}. Reason: ${reasonText}. Please check the reference number and resubmit, or call the shop.`,
      })

      return NextResponse.json({ success: true })
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Payment verification error:', error)
      return NextResponse.json(
        { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      )
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Outer payment verification error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
