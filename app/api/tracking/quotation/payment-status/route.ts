import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const jobOrderId = parseInt(new URL(request.url).searchParams.get('jobOrderId') ?? '', 10)
  if (isNaN(jobOrderId)) return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })

  try {
    const { rows } = await db.query(`SELECT * FROM get_job_order_payment_status($1)`, [jobOrderId])
    return NextResponse.json({ paymentStatus: rows[0] ?? null })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment-status] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}