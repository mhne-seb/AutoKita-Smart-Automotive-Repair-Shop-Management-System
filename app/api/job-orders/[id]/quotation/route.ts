import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const headerResult = await db.query(
      `
      SELECT jo.id, jo.quotation_notes, jo.grand_total,
             (pd.job_order_id IS NOT NULL) AS sent_to_customer
      FROM job_orders jo
      LEFT JOIN pre_diagnostics pd ON pd.job_order_id = jo.id
      WHERE jo.id = $1
      `,
      [id]
    )

    if (headerResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    const servicesResult = await db.query(
      `SELECT * FROM get_job_order_services($1)`,
      [id]
    )
    const partsResult = await db.query(
      `SELECT * FROM get_job_order_parts($1)`,
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...headerResult.rows[0],
        services: servicesResult.rows,
        parts: partsResult.rows,
      },
    })
  } catch (error) {
    console.error('Quotation fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}