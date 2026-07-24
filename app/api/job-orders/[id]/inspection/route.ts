import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // get_inspection_data() doesn't return timing fields, so we join it back
    // to job_orders for started_at / date_promised / estimated_duration —
    // used to populate the Time Tracking panel with real numbers.
    const headerResult = await db.query(
      `
      SELECT gid.*, jo.started_at, jo.date_promised, jo.estimated_duration, jo.grand_total
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

    return NextResponse.json({
      success: true,
      data: { ...headerResult.rows[0], findings: findingsResult.rows },
    })
  } catch (error) {
    console.error('Inspection fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}