import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// The customer's Warranties tab (Service History) — every warranty across
// every visit, active or past, via Jubert's get_customer_warranties /
// get_customer_warranty_history. Also flags a warranty that already has a
// pending claim, so the tab can hide/disable its Claim button.
export async function GET(request: NextRequest) {
  const userId = Number(request.nextUrl.searchParams.get('userId'))
  if (!userId) return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 })

  try {
    const [active, history, pending] = await Promise.all([
      db.query(`SELECT * FROM get_customer_warranties($1)`, [userId]),
      db.query(`SELECT * FROM get_customer_warranty_history($1)`, [userId]),
      db.query(
        `SELECT wc.warranty_id FROM warranty_claims wc
         JOIN warranties w ON w.id = wc.warranty_id
         JOIN job_orders jo ON jo.id = w.job_order_id
         WHERE jo.user_id = $1 AND wc.decision = 'pending'`,
        [userId],
      ),
    ])

    const pendingIds = new Set(pending.rows.map((r) => r.warranty_id))
    const map = (r: any) => ({
      warrantyId: r.warranty_id,
      description: r.coverage_description,
      startDate: r.start_date,
      expirationDate: r.expiration_date,
      status: r.status as string,
      jobOrderId: r.job_order_id,
      vehicle: [r.vehicle_model, r.plate_number].filter(Boolean).join(' — '),
      hasPendingClaim: pendingIds.has(r.warranty_id),
    })

    return NextResponse.json({
      success: true,
      active: active.rows.map(map),
      history: history.rows.map(map),
    })
  } catch (error) {
    console.error('[/api/customer/warranties] error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
