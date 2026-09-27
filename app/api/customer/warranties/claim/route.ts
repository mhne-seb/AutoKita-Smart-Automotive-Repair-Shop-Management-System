import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Customer reports a covered part failed. This doesn't decide anything —
// it just opens a normal service ticket (so it goes through Job Queue like
// any booking) tagged to the warranty, so the admin/mechanic can inspect the
// part before approving or denying the claim.
export async function POST(request: NextRequest) {
  const { userId, warrantyId, description, preferredDatetime, serviceMode } = await request.json().catch(() => ({}))
  const mode = serviceMode === 'Home Service' ? 'home_service' : 'walk_in'
  if (!userId || !warrantyId || !String(description ?? '').trim()) {
    return NextResponse.json({ success: false, message: 'userId, warrantyId and description are required' }, { status: 400 })
  }
  if (preferredDatetime && new Date(preferredDatetime).getTime() < Date.now()) {
    return NextResponse.json({ success: false, message: 'Pick a visit date and time that hasn\'t passed yet.' }, { status: 400 })
  }

  try {
    const w = await db.query(
      `SELECT w.id, w.status::text, w.expiration_date, w.coverage_description, jo.user_id, jo.vehicle_id, u.address
       FROM warranties w
       JOIN job_orders jo ON jo.id = w.job_order_id
       JOIN users u ON u.id = jo.user_id
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
    // Home service goes to the address on the customer's own account, read
    // here rather than trusted from the request.
    const homeAddress = String(warranty.address ?? '').trim()
    if (mode === 'home_service' && (!homeAddress || homeAddress === 'None')) {
      return NextResponse.json({ success: false, message: 'Add your home address to your profile first, or choose Shop Visit.' }, { status: 400 })
    }

    const pending = await db.query(
      `SELECT 1 FROM warranty_claims WHERE warranty_id = $1 AND decision = 'pending'`,
      [warrantyId],
    )
    if (pending.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'You already reported a problem with this part. The shop is still checking it.' }, { status: 409 })
    }

    const ticket = await db.query(
      `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        warranty.vehicle_id,
        mode,
        mode === 'home_service' ? homeAddress : 'None',
        `Warranty claim — ${warranty.coverage_description}: ${description}`,
        preferredDatetime || null,
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
