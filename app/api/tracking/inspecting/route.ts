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
      return NextResponse.json({ jobOrder: null, preDiagnostic: null, walkaround: [], findings: [], shop: null })
    }

    const [preDiagRes, findingsRes, walkaroundRes, shopRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_inspections($1)`, [jobOrder.job_order_id]),
       // Walkaround photos share the table with findings but aren't findings —
      // and the stored function above doesn't return `notes`, so they get their
      // own inline query here (no new stored function).
      db.query(
        `SELECT id, name AS label, notes AS note, photo, logged_date::text
         FROM vehicle_inspections
         WHERE job_order_id = $1 AND status = 'reference-photo' AND photo IS NOT NULL
         ORDER BY id`,
        [jobOrder.job_order_id],
      ),
      db.query(`SELECT * FROM get_dashboard_shop()`),
    ])

    return NextResponse.json({
      jobOrder,
      preDiagnostic: preDiagRes.rows[0] ?? null,
      walkaround: walkaroundRes.rows,
      // Keep reference-photo rows out of the findings list — they're intake
      // documentation, not something the mechanic diagnosed.
      findings: findingsRes.rows.filter((r) => r.status !== 'reference-photo'),
      shop: shopRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/inspecting] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}