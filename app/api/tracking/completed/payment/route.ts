import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadPaymentProof } from '@/lib/storage'
import { readTransferDetails } from '@/lib/paymentForm'
import { getJobOrderBill } from '@/lib/jobOrderBill'

// Customer settles the remaining balance on a finished job (paper: Table 16,
// "Access Final Bill and Payment"). Multipart because a transfer carries a
// proof screenshot.
//
// The amount is never taken from the client — it's always the live balance
// (services + parts − verified payments). Either way a `payments` row goes in
// as 'pending' and the admin verifies it on the Service Progress page:
//   - bank / e-wallet: channel + reference + proof, admin checks the account
//   - cash at the counter: recorded now as the customer's intent ("Pending
//     Counter Settlement"), admin confirms when the cash is in hand
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const jobOrderId = Number(form.get('jobOrderId'))
  const userId = Number(form.get('userId'))
  const method = String(form.get('method') ?? '')

  if (!jobOrderId || !userId || (method !== 'shop' && method !== 'ewallet')) {
    return NextResponse.json({ error: 'jobOrderId, userId and a valid method are required' }, { status: 400 })
  }

  try {
    const jo = await db.query(`SELECT user_id, status FROM job_orders WHERE id = $1`, [jobOrderId])
    const row = jo.rows[0]
    if (!row) return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    if (row.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (row.status !== 'completed' && row.status !== 'released') {
      return NextResponse.json({ error: 'The final bill is available once the service is completed' }, { status: 409 })
    }

    const bill = await getJobOrderBill(jobOrderId)
    if (bill.balance <= 0) {
      return NextResponse.json({ error: 'This job order is already fully paid' }, { status: 409 })
    }

    // One open payment at a time — but a customer who chose "cash at the
    // counter" and then transferred instead shouldn't be stuck. The cash
    // intent gets superseded (rejected) and the transfer goes in.
    const pending = bill.latestPayment?.verification_status === 'pending' ? bill.latestPayment : null
    if (pending) {
      const switchingFromCash = pending.payment_method === 'cash' && method === 'ewallet'
      if (!switchingFromCash) {
        return NextResponse.json({ error: 'A payment is already waiting for the shop to verify' }, { status: 409 })
      }
      await db.query(`UPDATE payments SET verification_status = 'rejected' WHERE id = $1`, [pending.id])
    }

    let dbMethod: 'cash' | 'e_wallet' | 'bank_transfer' = 'cash'
    let channelLabel: string | null = null
    let referenceNumber: string | null = null
    let proofUrl: string | null = null

    if (method === 'ewallet') {
      const transfer = readTransferDetails(form)
      if (!transfer.ok) return NextResponse.json({ error: transfer.error }, { status: transfer.status })
      dbMethod = transfer.channel.type
      channelLabel = transfer.channel.label
      referenceNumber = transfer.referenceNumber
      proofUrl = await uploadPaymentProof(String(jobOrderId), transfer.file)
    }

    const inserted = await db.query(
      `INSERT INTO payments
         (job_order_id, payment_method, amount_paid, payment_date, verification_status, payment_channel, reference_number, proof_of_payment_image)
       VALUES ($1, $2::payment_method, $3, NOW(), 'pending', $4, $5, $6)
       RETURNING id`,
      [jobOrderId, dbMethod, bill.balance, channelLabel, referenceNumber, proofUrl],
    )

    return NextResponse.json({ success: true, paymentId: inserted.rows[0].id, amount: bill.balance })
  } catch (err) {
    console.error('[/api/tracking/completed/payment] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
