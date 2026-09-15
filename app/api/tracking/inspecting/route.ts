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
       // Walkaround photos from inspection_photos (child of vehicle_inspections)
      db.query(
        `SELECT p.id, p.title AS label, p.note, p.photo_url AS photo, p.logged_at::text AS logged_date
         FROM inspection_photos p
         JOIN vehicle_inspections vi ON vi.id = p.inspection_id
         WHERE vi.job_order_id = $1 AND p.photo_url IS NOT NULL
         ORDER BY p.id`,
        [jobOrder.job_order_id],
      ),
      // Every round the shop has sent, with the customer's answer (if any)
      // pulled from the audit log. pre_diagnostics is now joined through vehicle_inspections.
      db.query(
        `SELECT pd.id,
                pd.mechanic_notes,
                pd.customer_approval_status::text AS status,
                pd.datetime_created::text          AS sent_at,
                sal.new_values                     AS customer_reason,
                sal.action_date::text              AS responded_at
         FROM pre_diagnostics pd
         JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
         LEFT JOIN system_audit_logs sal
           ON sal.entity_type = 'pre_diagnostics'
          AND sal.entity_id = pd.id
          AND sal.action_performed IN ('approved', 'rejected')
         WHERE vi.job_order_id = $1
         ORDER BY pd.datetime_created ASC`,
        [jobOrder.job_order_id],
      ),
      db.query(`SELECT * FROM get_dashboard_shop()`),
      // Mirrors the guard in /api/customer/job-orders/cancel exactly, so the
      // page only offers a Cancel button that will actually succeed.
      db.query(
        `SELECT (
            jo.status = 'inspecting'
            AND NOT EXISTS (
              SELECT 1 FROM vehicle_inspections vi
              WHERE vi.job_order_id = jo.id
                AND (
                  EXISTS (SELECT 1 FROM inspection_photos ip WHERE ip.inspection_id = vi.id)
                  OR EXISTS (SELECT 1 FROM pre_diagnostics pd WHERE pd.inspection_id = vi.id)
                )
            )
         ) AS can_cancel
         FROM job_orders jo WHERE jo.id = $1`,
        [jobOrder.job_order_id],
      ),
    ])

    const preDiagnostic = preDiagRes.rows[0] ?? null

    // Until the mechanic clicks "Upload to customer portal" there is no round,
    // and what's in vehicle_inspections is a draft — don't hand it to the
    // customer's browser at all. Completed/released jobs are the read-only
    // history view and always show what was recorded.
    const isHistorical = jobOrder.status === 'completed' || jobOrder.status === 'released'
    const reportSent = Boolean(preDiagnostic?.approval_status) || isHistorical

    return NextResponse.json({
      jobOrder,
      preDiagnostic,
      walkaround: reportSent ? walkaroundRes.rows : [],
      reviewHistory: historyRes.rows,
      canCancel: Boolean(cancelRes.rows[0]?.can_cancel),
      // Keep reference-photo rows out of the findings list — they're intake
      // documentation, not something the mechanic diagnosed.
      findings: reportSent ? findingsRes.rows.filter((r) => r.status !== 'reference-photo') : [],
      shop: shopRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/inspecting] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}