import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'
import { getLatestScanAuthorization } from '@/lib/scanAuthorization'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // get_inspection_data() doesn't return timing fields, so we join it back
    // to job_orders for started_at / date_promised / estimated_duration —
    // used to populate the Time Tracking panel with real numbers.
    const headerResult = await db.query(
      `
      SELECT gid.*, jo.started_at, jo.date_promised, jo.estimated_duration, jo.actual_grand_total,
             u.contact_number
      FROM get_inspection_data($1) gid
      JOIN job_orders jo ON jo.id = gid.id
      JOIN users u ON u.id = jo.user_id
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
      `SELECT id, title, note, photo_url, logged_at
       FROM get_inspection_photos($1)`,
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

    // What the customer originally asked for when they booked — the mechanic
    // should read this before inspecting. Lives on the ticket, not the job
    // order, so it's joined back here (inline — no stored function covers it).
    const ticketResult = await db.query(
      `SELECT st.service_mode::text, st.home_service_address, st.customer_concern, st.request_date::text
       FROM job_orders jo
       JOIN service_tickets st ON st.id = jo.ticket_id
       WHERE jo.id = $1`,
      [id],
    )

    // Has the admin started building the quotation? Any service other than
    // the OBD-II fee (which is attached automatically at booking) means yes.
    // Used to show the "Continue to Quotation" handoff only until it's used.
    const startedResult = await db.query(
      `SELECT EXISTS (
         SELECT 1 FROM job_order_services jos
         JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = $1 AND s.service_name <> $2
       ) AS started`,
      [id, DIAGNOSTIC_SCAN_SERVICE_NAME],
    )

    // Pending / approved / declined mid-inspection scan request, if the
    // customer wasn't already asked at booking — see scan-authorization/route.ts.
    const scanAuthorization = await getLatestScanAuthorization(Number(id))

    return NextResponse.json({
      success: true,
      data: {
        ...headerResult.rows[0],
        findings: findingsResult.rows,
        referencePhotos: photoResult.rows,
        diagnosticScanAuthorized: Boolean(scanResult.rows[0]?.authorized),
        scanAuthorization,
        ticket: ticketResult.rows[0] ?? null,
        quotationStarted: Boolean(startedResult.rows[0]?.started),
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