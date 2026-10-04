import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'

import { effectiveWarrantyStatus } from '@/lib/warranty'

export async function GET(request: NextRequest) {
  const userIdParam = request.nextUrl.searchParams.get('userId')
  const guard = await (userIdParam ? requireCustomer(parseInt(userIdParam, 10)) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

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
      status: effectiveWarrantyStatus(r.status as string, r.expiration_date),
      jobOrderId: r.job_order_id,
      vehicle: [r.vehicle_model, r.plate_number].filter(Boolean).join(' — '),
      hasPendingClaim: pendingIds.has(r.warranty_id),
      completedAt: r.completed_at ?? null,
    })

    const mappedActive = active.rows.map(map)
    const mappedHistory = history.rows.map(map)

    const trulyActive = mappedActive.filter(w => w.status === 'active' || w.status === 'nearing_expiration')
    const actuallyExpired = mappedActive.filter(w => w.status !== 'active' && w.status !== 'nearing_expiration')
    
    const combinedHistory = [...actuallyExpired, ...mappedHistory]

    const sortWarranties = (list: any[]) => {
      return list.sort((a, b) => {
        const dateA = a.completedAt ?? a.startDate
        const dateB = b.completedAt ?? b.startDate
        const tA = dateA ? new Date(dateA).getTime() : 0
        const tB = dateB ? new Date(dateB).getTime() : 0
        if (tB !== tA) return tB - tA
        return a.warrantyId - b.warrantyId
      })
    }

    return NextResponse.json({
      success: true,
      active: sortWarranties(trulyActive),
      history: sortWarranties(combinedHistory),
    })
  } catch (error) {
    console.error('[/api/customer/warranties] error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 },
    )
  }
}
