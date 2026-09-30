import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams
  const jobOrderId = parseInt(searchParams.get('jobOrderId') ?? '', 10)
  
  if (isNaN(jobOrderId)) {
    return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })
  }

  const guard = await requireCustomer()
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  const ownerCheck = await db.query(`SELECT user_id FROM job_orders WHERE id = $1`, [jobOrderId])
  if (ownerCheck.rows.length === 0) return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
  if (ownerCheck.rows[0].user_id !== userId) return NextResponse.json({ error: 'Not your account.' }, { status: 403 })

  try {
    const { rows } = await db.query(
      `SELECT id, payment_method, amount_paid, verification_status, payment_date, rejection_reason 
       FROM payments 
       WHERE job_order_id = $1 
       ORDER BY payment_date DESC LIMIT 1`, 
      [jobOrderId]
    )
    return NextResponse.json({ paymentStatus: rows[0] ?? null })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment-status] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}