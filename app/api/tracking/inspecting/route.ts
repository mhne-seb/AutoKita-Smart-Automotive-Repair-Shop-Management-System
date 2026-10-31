import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { getLatestScanAuthorization } from '@/lib/scanAuthorization'
import { signFileUrls } from '@/lib/storage'
import { getServiceModeValue } from '@/lib/jobOrderMode'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')

  const guard = await (userIdParam ? requireCustomer(parseInt(userIdParam, 10)) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

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
        jobOrder: null, preDiagnostic: null, walkaround: [], findings: [], diagnosticReport: null, diagnosticTroubleCodes: [], scannerFindings: [], reviewHistory: [], shop: null,
        canCancel: false, scanAuthorization: null,
      })
    }

    if (jobOrder) jobOrder.service_mode = await getServiceModeValue(jobOrder.job_order_id)

    const [preDiagRes, findingsRes, walkaroundRes, historyRes, shopRes, cancelRes, diagRes] = await Promise.all([
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
      // Linked OBD-II report and trouble codes for this job order
      db.query(
        `SELECT
           r.scanner_tool,
           r.scanner_software,
           r.report_date::text AS report_date,
           r.test_mileage,
           r.reported_make,
           r.reported_model,
           r.reported_year,
           r.reported_vin,
           r.reported_plate,
           r.linked_at::text AS linked_at,
           d.dtc_code,
           d.description AS dtc_description,
           d.state       AS dtc_state,
           d.system      AS dtc_system
         FROM obd2_diagnostic_reports r
         LEFT JOIN obd2_dtc_codes d ON d.report_id = r.id
         WHERE r.job_order_id = $1
         ORDER BY d.datetime_logged ASC`,
        [jobOrder.job_order_id],
      ),
    ])

    const preDiagnostic = preDiagRes.rows[0] ?? null

    const isHistorical = jobOrder.status === 'completed' || jobOrder.status === 'released'
    const reportSent = Boolean(preDiagnostic?.approval_status) || isHistorical

    // Pending / decided mid-inspection scan request — the card the customer
    // approves/declines from this page (see scan-authorization/*).
    const scanAuthorization = await getLatestScanAuthorization(jobOrder.job_order_id)

    const walkaround = reportSent ? walkaroundRes.rows : []
    const findings = reportSent ? findingsRes.rows.filter((r) => !(r.status === null && r.photo)) : []
    const signed = await signFileUrls([...walkaround.map((w) => w.photo), ...findings.map((f) => f.photo)])
    walkaround.forEach((w, i) => { w.photo = signed[i] })
    findings.forEach((f, i) => { f.photo = signed[walkaround.length + i] })

    let diagnosticReport: {
      scanner_tool: string | null
      scanner_software: string | null
      report_date: string | null
      test_mileage: number | null
      reported_make: string | null
      reported_model: string | null
      reported_year: number | null
      reported_vin: string | null
      reported_plate: string | null
      linked_at: string | null
    } | null = null

    let diagnosticTroubleCodes: {
      dtc_code: string
      dtc_description: string | null
      dtc_state: string | null
      dtc_system: string | null
    }[] = []

    if (reportSent && diagRes.rows.length > 0) {
      const first = diagRes.rows[0]
      diagnosticReport = {
        scanner_tool: first.scanner_tool ?? null,
        scanner_software: first.scanner_software ?? null,
        report_date: first.report_date != null ? String(first.report_date) : null,
        test_mileage: first.test_mileage != null ? Number(first.test_mileage) : null,
        reported_make: first.reported_make ?? null,
        reported_model: first.reported_model ?? null,
        reported_year: first.reported_year != null ? Number(first.reported_year) : null,
        reported_vin: first.reported_vin ? String(first.reported_vin).trim() : null,
        reported_plate: first.reported_plate ? String(first.reported_plate).trim() : null,
        linked_at: first.linked_at != null ? String(first.linked_at) : null,
      }
      diagnosticTroubleCodes = diagRes.rows
        .filter((r) => r.dtc_code !== null && r.dtc_code !== undefined)
        .map((r) => ({
          dtc_code: String(r.dtc_code),
          dtc_description: r.dtc_description ?? null,
          dtc_state: r.dtc_state ?? null,
          dtc_system: r.dtc_system ?? null,
        }))
    }

    return NextResponse.json({
      jobOrder,
      preDiagnostic,
      walkaround,
      reviewHistory: historyRes.rows,
      canCancel: Boolean(cancelRes.rows[0]?.can_cancel),
      scanAuthorization,
      findings,
      diagnosticReport,
      diagnosticTroubleCodes,
      scannerFindings: reportSent
        ? diagnosticTroubleCodes
            .filter((c) => (c.dtc_state ?? '').toLowerCase() === 'current' && c.dtc_description)
            .map((c) => c.dtc_description as string)
        : [],
      shop: shopRes.rows[0] ?? null,
    })
  } catch (err) {
    console.error('[/api/tracking/inspecting] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}