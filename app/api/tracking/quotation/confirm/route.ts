import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { jobOrderId, acceptedServiceIds } = await request.json()
  if (!jobOrderId || !Array.isArray(acceptedServiceIds)) return NextResponse.json({ error: 'jobOrderId and acceptedServiceIds are required' }, { status: 400 })

  try {
    const { rows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (rows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    // Delete rejected services
    await db.query(
      `DELETE FROM job_order_services WHERE job_order_id = $1 AND id != ALL($2::int[])`,
      [jobOrderId, acceptedServiceIds]
    )

    // Delete rejected parts (ID 999999 is the pseudo-service representing all parts)
    if (!acceptedServiceIds.includes(999999)) {
      await db.query(`DELETE FROM job_order_parts WHERE job_order_id = $1`, [jobOrderId])
    }

    await db.query(`SELECT set_quotation_approval($1, $2)`, [jobOrderId, true])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/tracking/quotation/confirm] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}