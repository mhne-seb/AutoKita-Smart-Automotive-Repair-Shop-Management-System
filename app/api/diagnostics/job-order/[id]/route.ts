import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/diagnostics/job-order/[id]
 *
 * Returns the OBD-II diagnostic report linked to a specific job order,
 * along with all its DTC codes.
 *
 * Response when linked:
 *   { report: { report_id, scanner_tool, ... }, dtc_codes: [...] }
 *
 * Response when not linked:
 *   { report: null, dtc_codes: [] }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const jobOrderId = parseInt(id, 10)
  if (isNaN(jobOrderId)) {
    return NextResponse.json({ error: 'Invalid job order ID' }, { status: 400 })
  }

  try {
    const result = await db.query(
      `SELECT
         r.id                AS report_id,
         r.scanner_tool,
         r.scanner_software,
         r.report_date,
         r.test_mileage,
         r.reported_vin,
         r.reported_plate,
         r.reported_make,
         r.reported_model,
         r.reported_year,
         r.reported_engine,
         r.filename,
         r.source,
         r.pdf_storage_url,
         r.linked_at,
         e.full_name         AS linked_by_name,
         r.datetime_created,
         d.id                AS dtc_id,
         d.dtc_code,
         d.description       AS dtc_description,
         d.state             AS dtc_state,
         d.system            AS dtc_system
       FROM obd2_diagnostic_reports r
       LEFT JOIN obd2_dtc_codes d ON d.report_id = r.id
       LEFT JOIN employees e      ON e.id = r.linked_by
       WHERE r.job_order_id = $1
       ORDER BY d.datetime_logged ASC`,
      [jobOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ report: null, dtc_codes: [] })
    }

    // First row holds the report header (repeated for each DTC)
    const first = result.rows[0]
    const report = {
      report_id:        first.report_id,
      scanner_tool:     first.scanner_tool,
      scanner_software: first.scanner_software,
      report_date:      first.report_date,
      test_mileage:     first.test_mileage,
      reported_vin:     first.reported_vin,
      reported_plate:   first.reported_plate,
      reported_make:    first.reported_make,
      reported_model:   first.reported_model,
      reported_year:    first.reported_year,
      reported_engine:  first.reported_engine,
      filename:         first.filename,
      source:           first.source,
      pdf_storage_url:  first.pdf_storage_url,
      linked_at:        first.linked_at,
      linked_by_name:   first.linked_by_name,
      datetime_created: first.datetime_created,
    }

    // Collect DTC rows (skip rows with null dtc_id — report has no codes)
    const dtc_codes = result.rows
      .filter((r) => r.dtc_id !== null)
      .map((r) => ({
        dtc_id:          r.dtc_id,
        dtc_code:        r.dtc_code,
        dtc_description: r.dtc_description,
        dtc_state:       r.dtc_state,
        dtc_system:      r.dtc_system,
      }))

    return NextResponse.json({ report, dtc_codes })
  } catch (err) {
    console.error('[/api/diagnostics/job-order/[id]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
