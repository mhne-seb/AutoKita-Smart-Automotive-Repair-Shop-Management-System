import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')

  const userId = parseInt(userIdParam ?? '', 10)
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
      return NextResponse.json({ jobOrder: null, preDiagnostic: null, findings: [], shop: null })
    }

    const [preDiagRes, findingsRes, shopRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_inspections($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_dashboard_shop()`),
    ])

    return NextResponse.json({
      jobOrder,
      preDiagnostic: preDiagRes.rows[0] ?? null,
      findings: findingsRes.rows,
      shop: shopRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/inspecting] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}