// /api/dashboard — Returns all data needed by the Customer Dashboard.
// Expects ?userId=<number> query parameter.

import { NextRequest, NextResponse } from 'next/server'
import { getFullDashboardData } from '@/controllers/dashboardController'
import { requireCustomer } from '@/lib/authGuard'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const guard = await (userIdParam ? requireCustomer(parseInt(userIdParam, 10)) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  try {
    const data = await getFullDashboardData(userId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    console.error('[/api/dashboard] Error fetching dashboard data:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
