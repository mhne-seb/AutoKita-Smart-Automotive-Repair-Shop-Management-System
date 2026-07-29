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

    const [servicesRes, paymentRes, partsRes, preDiagRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation_services($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_payment_status($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_parts($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT customer_approval_status FROM pre_diagnostics WHERE job_order_id = $1 ORDER BY id DESC LIMIT 1`, [jobOrder.job_order_id]),
    ])

    const latestStatus = preDiagRes.rows[0]?.customer_approval_status
    const isReady = latestStatus === 'pending' || latestStatus === 'approved' || jobOrder.quotation_approved

    let services = servicesRes.rows
    const parts = partsRes.rows

    // Map parts into their respective services
    services = services.map((s: any) => {
      const serviceParts = parts.filter((p: any) => p.job_order_service_id === s.id)
      const partsTotal = serviceParts.reduce((sum: number, p: any) => sum + Number(p.total_retail_amount), 0)
      
      return {
        ...s,
        parts: serviceParts,
        estimated_amount: s.estimated_amount ? String(Number(s.estimated_amount) + partsTotal) : null,
        actual_amount: String(Number(s.actual_amount) + partsTotal)
      }
    })

    if (!isReady) {
      services = []
    }

    return NextResponse.json({
      jobOrder,
      services,
      quotationStatus: isReady ? 'ready' : 'preparing',
      paymentStatus: paymentRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/quotation] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}