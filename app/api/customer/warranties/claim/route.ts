import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Customer reports a covered part failed. This doesn't decide anything —
// it just opens a normal service ticket (so it goes through Job Queue like
// any booking) tagged to the warranty, so the admin/mechanic can inspect the
// part before approving or denying the claim.
export async function POST(request: NextRequest) {
  const { userId, warrantyId, description } = await request.json().catch(() => ({}))
  if (!userId || !warrantyId || !String(description ?? '').trim()) {
    return NextResponse.json({ success: false, message: 'userId, warrantyId and description are required' }, { status: 400 })
  }

  try {
    const w = await db.query(
      `SELECT w.id, w.status::text, w.expiration_date, w.coverage_description, jo.user_id, jo.vehicle_id
       FROM warranties w JOIN job_orders jo ON jo.id = w.job_order_id
       WHERE w.id = $1`,
      [warrantyId],
    )
    const warranty = w.rows[0]
    if (!warranty || warranty.user_id !== userId) {
      return NextResponse.json({ success: false, message: 'Warranty not found' }, { status: 404 })
    }
    if (warranty.status !== 'active' && warranty.status !== 'nearing_expiration') {
      return NextResponse.json({ success: false, message: 'This warranty is not active' }, { status: 409 })
    }

    const pending = await db.query(
      `SELECT 1 FROM warranty_claims WHERE warranty_id = $1 AND decision = 'pending'`,
      [warrantyId],
    )
    if (pending.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'A claim for this warranty is already being reviewed' }, { status: 409 })
    }

    const ticket = await db.query(
      `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        warranty.vehicle_id,
        'walk_in',
        'None',
        `Warranty claim — ${warranty.coverage_description}: ${description}`,
        null,
      ],
    )
    const ticketId = ticket.rows[0].id

    await db.query(
      `INSERT INTO warranty_claims (warranty_id, ticket_id, customer_description)
       VALUES ($1, $2, $3)`,
      [warrantyId, ticketId, description],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[/api/customer/warranties/claim] error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
