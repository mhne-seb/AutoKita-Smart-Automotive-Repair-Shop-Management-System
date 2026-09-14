import { NextRequest, NextResponse } from 'next/server'
import { getDashboardRecentActivity } from '@/controllers/dashboardController'

// Feeds the header notification bell. Reuses the dashboard activity feed
// (payments, repair updates, status changes, booking-accepted) — no new query.

export async function GET(req: NextRequest) {
  const userIdParam = req.nextUrl.searchParams.get('userId')
  const userId = userIdParam ? parseInt(userIdParam, 10) : NaN

  if (isNaN(userId)) {
    return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
  }

  try {
    const notifications = await getDashboardRecentActivity(userId)
    return NextResponse.json({ notifications })
  } catch (err: any) {
    console.error('[/api/customer/notifications] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}