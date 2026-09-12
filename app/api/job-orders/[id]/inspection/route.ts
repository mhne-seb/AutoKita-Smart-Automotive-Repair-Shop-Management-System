import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // get_inspection_data() doesn't return timing fields, so we join it back
    // to job_orders for started_at / date_promised / estimated_duration —
    // used to populate the Time Tracking panel with real numbers.
    const headerResult = await db.query(
      `
      SELECT gid.*, jo.started_at, jo.date_promised, jo.estimated_duration, jo.actual_grand_total
      FROM get_inspection_data($1) gid
      JOIN job_orders jo ON jo.id = gid.id
      `,
      [id]
    )

    if (headerResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    const findingsResult = await db.query(
      `SELECT * FROM get_inspection_findings($1)`,
      [id]
    )

    const photoResult = await db.query(
      `SELECT id, findings_description AS slot_id, name AS label, notes as note, photo
      FROM vehicle_inspections
      WHERE job_order_id = $1 AND status = 'reference-photo'`,
      [id]
    )

    // Whether the customer pre-authorized the OBD-II scan — the fee row is
    // attached at job-order creation, so its presence is the signal.
    const scanResult = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM job_order_services jos
         JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = $1 AND s.service_name = $2
       ) AS authorized`,
      [id, DIAGNOSTIC_SCAN_SERVICE_NAME],
    )

    return NextResponse.json({
      success: true,
      data: {
        ...headerResult.rows[0],
        findings: findingsResult.rows,
        referencePhotos: photoResult.rows,
        diagnosticScanAuthorized: Boolean(scanResult.rows[0]?.authorized),
      },
    })
  } catch (error) {
    console.error('Inspection fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}