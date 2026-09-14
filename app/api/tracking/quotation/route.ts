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

    const [servicesRes, paymentRes, partsRes, preDiagRes, scanAuthRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation_services($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_payment_status($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_parts($1)`, [jobOrder.job_order_id]),
      db.query(
        `SELECT pd.customer_approval_status
         FROM pre_diagnostics pd
         JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
         WHERE vi.job_order_id = $1
         ORDER BY pd.id DESC
         LIMIT 1`,
        [jobOrder.job_order_id],
      ),
      // The real "did the customer actually agree to this at booking" signal —
      // an audit-log event on the original ticket, not just "is the OBD-II
      // line item present on the job order" (a mechanic can add that line
      // item later, e.g. for an "Others" booking, without the customer ever
      // having pre-authorized it).
      db.query(
        `SELECT EXISTS (
           SELECT 1 FROM system_audit_logs sal
           JOIN job_orders jo ON jo.ticket_id = sal.entity_id
           WHERE jo.id = $1
             AND sal.entity_type = 'service_tickets'
             AND sal.action_performed = 'approved'
         ) AS authorized`,
        [jobOrder.job_order_id],
      ),
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
      jobOrder: { ...jobOrder, diagnostic_scan_authorized: Boolean(scanAuthRes.rows[0]?.authorized) },
      services,
      quotationStatus: isReady ? 'ready' : 'preparing',
      paymentStatus: paymentRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/quotation] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}