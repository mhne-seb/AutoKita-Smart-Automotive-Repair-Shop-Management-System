import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { jobOrderId } = await request.json()
  if (!jobOrderId) return NextResponse.json({ error: 'jobOrderId is required' }, { status: 400 })

  try {
    const { rows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (rows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    await db.query(`SELECT set_quotation_approval($1, $2)`, [jobOrderId, true])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/tracking/quotation/confirm] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}