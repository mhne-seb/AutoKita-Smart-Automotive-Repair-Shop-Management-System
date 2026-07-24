import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const detailResult = await db.query(
      `SELECT * FROM "Capstone-Testing".get_job_order_detail($1)`,
      [id]
    )

    if (detailResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    // Service names aren't part of get_job_order_detail(), so we pull them
    // separately from get_job_order_services() and combine into one payload.
    const servicesResult = await db.query(
      `SELECT service_name FROM "Capstone-Testing".get_job_order_services($1)`,
      [id]
    )
    const serviceNames = servicesResult.rows.map((r) => r.service_name).join(', ')

    return NextResponse.json({
      success: true,
      data: { ...detailResult.rows[0], service_names: serviceNames },
    })
  } catch (error) {
    console.error('Job order fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}