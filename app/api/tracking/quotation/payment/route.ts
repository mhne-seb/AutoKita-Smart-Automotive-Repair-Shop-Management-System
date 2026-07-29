import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { jobOrderId, method, amount, acceptedServiceIds } = await request.json()
  if (!jobOrderId || !method || amount == null || !Array.isArray(acceptedServiceIds)) {
    return NextResponse.json({ error: 'jobOrderId, method, amount, and acceptedServiceIds are required' }, { status: 400 })
  }

  const dbMethod = method === 'shop' ? 'cash' : 'e_wallet'

  try {
    const { rows: joRows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (joRows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    // Delete rejected services
    await db.query(
      `DELETE FROM job_order_services WHERE job_order_id = $1 AND id != ALL($2::int[])`,
      [jobOrderId, acceptedServiceIds]
    )

    // Delete rejected parts (ID 999999 is the pseudo-service representing all parts)
    if (!acceptedServiceIds.includes(999999)) {
      await db.query(`DELETE FROM job_order_parts WHERE job_order_id = $1`, [jobOrderId])
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