import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')

  if (!userIdParam) {
    return NextResponse.json({ error: 'Missing required query parameter: userId' }, { status: 400 })
  }
  const userId = parseInt(userIdParam, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
  }

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
      const { rows } = await db.query(`SELECT * FROM get_customer_completed_job_order($1)`, [userId])
      jobOrder = rows[0] ?? null
    }

    if (!jobOrder) {
      return NextResponse.json({ jobOrder: null, logs: [], warranties: [], services: [], parts: [] })
    }

    const [logsRes, warrantiesRes, servicesRes, partsRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_repair_logs($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_warranties($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_invoice_services($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_invoice_parts($1)`, [jobOrder.job_order_id]),
    ])

    return NextResponse.json({
      jobOrder,
      logs: logsRes.rows,
      warranties: warrantiesRes.rows,
      services: servicesRes.rows,
      parts: partsRes.rows,
    })
  } catch (err) {
    console.error('[/api/tracking/completed] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}