import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { jobOrderId, method, amount } = await request.json()
  if (!jobOrderId || !method || amount == null) {
    return NextResponse.json({ error: 'jobOrderId, method, and amount are required' }, { status: 400 })
  }

  const dbMethod = method === 'shop' ? 'cash' : 'e_wallet'

  try {
    const { rows: joRows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (joRows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    const { rows } = await db.query(
      `SELECT submit_job_order_payment($1, $2, $3) AS payment_id`,
      [jobOrderId, dbMethod, amount]
    )

    // Submitting payment counts as confirming the quotation selection —
    // lock it immediately so it can't be re-picked while payment is pending.
    await db.query(`SELECT set_quotation_approval($1, $2)`, [jobOrderId, true])

    return NextResponse.json({ success: true, paymentId: rows[0].payment_id })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}