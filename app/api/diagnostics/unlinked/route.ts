import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/diagnostics/unlinked
 *
 * Returns all obd2_diagnostic_reports where job_order_id IS NULL.
 * Used by the UI picker when attaching a report to a Job Order.
 *
 * Response:
 *   { reports: OBD2Report[] }
 */
export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        r.id,
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
        r.datetime_created,
        COUNT(d.id)::int AS dtc_count
      FROM obd2_diagnostic_reports r
      LEFT JOIN obd2_dtc_codes d ON d.report_id = r.id
      WHERE r.job_order_id IS NULL
      GROUP BY r.id
      ORDER BY r.datetime_created DESC
    `)

    return NextResponse.json({ reports: result.rows })
  } catch (err) {
    console.error('[/api/diagnostics/unlinked] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/diagnostics/unlinked
 *
 * Permanently deletes an unlinked OBD-II diagnostic report and its DTC codes.
 *
 * Body:
 *   { report_id: number, employee_id?: number }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { report_id, employee_id = 1 } = body

    if (!report_id) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 })
    }

    // Safety: ensure it is truly unlinked before permanently deleting
    const check = await db.query(
      `SELECT job_order_id, filename FROM obd2_diagnostic_reports WHERE id = $1`,
      [report_id]
    )
    if (check.rowCount === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    if (check.rows[0].job_order_id !== null) {
      return NextResponse.json(
        { error: 'Cannot permanently delete an attached report. Detach it first.' },
        { status: 400 }
      )
    }

    const filename = check.rows[0].filename

    // Delete DTC codes first, then report
    await db.query(`DELETE FROM obd2_dtc_codes WHERE report_id = $1`, [report_id])
    await db.query(`DELETE FROM obd2_diagnostic_reports WHERE id = $1`, [report_id])

    // Log to system_audit_logs
    await db.query(
      `INSERT INTO system_audit_logs
         (employees_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'deleted', 'obd2_diagnostic_reports', $2, $3, NOW())`,
      [employee_id, report_id, JSON.stringify({ filename, deleted_at: new Date().toISOString() })]
    )

    return NextResponse.json({ success: true, action: 'deleted', report_id })
  } catch (err) {
    console.error('[/api/diagnostics/unlinked DELETE] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
