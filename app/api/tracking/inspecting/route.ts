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
      return NextResponse.json({
        jobOrder: null, preDiagnostic: null, walkaround: [], findings: [], reviewHistory: [], shop: null,
        canCancel: false,
      })
    }

    const [preDiagRes, findingsRes, walkaroundRes, historyRes, shopRes, cancelRes] = await Promise.all([
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
      // Every round the shop has sent, with the customer's answer (if any)
      // pulled from the audit log. The respond endpoint refuses a second
      // answer on the same round, so the LEFT JOIN yields at most one row
      // per round. Inline query — get_pre_diagnostic() only returns the latest.
      db.query(
        `SELECT pd.id,
                pd.mechanic_notes,
                pd.customer_approval_status::text AS status,
                pd.datetime_created::text          AS sent_at,
                sal.new_values                     AS customer_reason,
                sal.action_date::text              AS responded_at
         FROM pre_diagnostics pd
         LEFT JOIN system_audit_logs sal
           ON sal.entity_type = 'pre_diagnostics'
          AND sal.entity_id = pd.id
          AND sal.action_performed IN ('approved', 'rejected')
         WHERE pd.job_order_id = $1
         ORDER BY pd.datetime_created ASC`,
        [jobOrder.job_order_id],
      ),
      db.query(`SELECT * FROM get_dashboard_shop()`),
      // Mirrors the guard in /api/customer/job-orders/cancel exactly, so the
      // page only offers a Cancel button that will actually succeed.
      db.query(
        `SELECT (
            jo.status = 'inspecting'
            AND NOT EXISTS (SELECT 1 FROM vehicle_inspections vi WHERE vi.job_order_id = jo.id)
            AND NOT EXISTS (SELECT 1 FROM pre_diagnostics pd WHERE pd.job_order_id = jo.id)
         ) AS can_cancel
         FROM job_orders jo WHERE jo.id = $1`,
        [jobOrder.job_order_id],
      ),
    ])

    return NextResponse.json({
      jobOrder,
      preDiagnostic: preDiagRes.rows[0] ?? null,
      walkaround: walkaroundRes.rows,
      reviewHistory: historyRes.rows,
      canCancel: Boolean(cancelRes.rows[0]?.can_cancel),
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