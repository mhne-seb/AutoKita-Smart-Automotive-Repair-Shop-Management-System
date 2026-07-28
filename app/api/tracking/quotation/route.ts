import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = parseInt(searchParams.get('userId') ?? '', 10)
  const jobOrderIdParam = searchParams.get('jobOrderId')

  if (isNaN(userId)) return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })

  try {
    let jobOrder
    if (jobOrderIdParam) {
      const jobOrderId = parseInt(jobOrderIdParam, 10)
      if (isNaN(jobOrderId)) {
        return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })
      }
      const { rows } = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
      jobOrder = rows[0] ?? null
      if (jobOrder && jobOrder.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { rows } = await db.query(`SELECT * FROM get_customer_active_job_order($1)`, [userId])
      jobOrder = rows[0] ?? null
    }

    if (!jobOrder) {
      return NextResponse.json({ jobOrder: null, services: [], paymentStatus: null })
    }

    const [servicesRes, paymentRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation_services($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_payment_status($1)`, [jobOrder.job_order_id]),
    ])

    return NextResponse.json({
      jobOrder,
      services: servicesRes.rows,
      paymentStatus: paymentRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/quotation] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}