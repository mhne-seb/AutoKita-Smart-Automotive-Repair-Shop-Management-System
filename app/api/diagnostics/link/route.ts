import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * PATCH /api/diagnostics/link
 *
 * Manually links an obd2_diagnostic_reports row to a Job Order.
 * Can only link if job_order_id is currently NULL (prevents accidental re-assignment).
 *
 * Body:
 *   { report_id: number, job_order_id: number, employee_id: number }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { report_id, job_order_id, employee_id } = body

    if (!report_id || !job_order_id || !employee_id) {
      return NextResponse.json(
        { error: 'report_id, job_order_id, and employee_id are required' },
        { status: 400 }
      )
    }

    // Only allow linking if not already linked
    const existing = await db.query<{ job_order_id: number | null }>(
      `SELECT job_order_id FROM obd2_diagnostic_reports WHERE id = $1`,
      [report_id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    if (existing.rows[0].job_order_id !== null) {
      return NextResponse.json(
        { error: 'Report is already linked to a Job Order' },
        { status: 409 }
      )
    }

    // Link the report
    await db.query(
      `UPDATE obd2_diagnostic_reports
         SET job_order_id = $1,
             linked_by    = $2,
             linked_at    = NOW()
       WHERE id = $3`,
      [job_order_id, employee_id, report_id]
    )

    // Audit log
    await db.query(
      `INSERT INTO system_audit_logs
         (employees_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'updated', 'obd2_diagnostic_reports', $2, $3, NOW())`,
      [
        employee_id,
        report_id,
        JSON.stringify({ job_order_id, linked_by: employee_id }),
      ]
    )

    return NextResponse.json({ success: true, report_id, job_order_id })
  } catch (err) {
    console.error('[/api/diagnostics/link] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/diagnostics/link
 *
 * Detaches an OBD-II diagnostic report from a Job Order.
 * Sets job_order_id, linked_by, and linked_at to NULL so the report
 * returns to the unlinked pool and can be assigned to another vehicle.
 * Does NOT delete the report or its DTC codes.
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

    // Unlink from the Job Order and return to unlinked pool
    await db.query(
      `UPDATE obd2_diagnostic_reports
          SET job_order_id = NULL,
              linked_by    = NULL,
              linked_at    = NULL
        WHERE id = $1`,
      [report_id]
    )

    await db.query(
      `INSERT INTO system_audit_logs
         (employees_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'updated', 'obd2_diagnostic_reports', $2, $3, NOW())`,
      [employee_id, report_id, JSON.stringify({ action: 'unlinked', unlinked_at: new Date().toISOString() })]
    )

    return NextResponse.json({ success: true, action: 'unlinked', report_id })
  } catch (err) {
    console.error('[/api/diagnostics/link DELETE] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
