// /api/dashboard — Returns all data needed by the Customer Dashboard.
// Expects ?userId=<number> query parameter.

import { NextRequest, NextResponse } from 'next/server'
import { getFullDashboardData } from '@/controllers/dashboardController'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')

  if (!userIdParam) {
    return NextResponse.json(
      { error: 'Missing required query parameter: userId' },
      { status: 400 },
    )
  }

  const userId = parseInt(userIdParam, 10)
  if (isNaN(userId)) {
    return NextResponse.json(
      { error: 'userId must be a number' },
      { status: 400 },
    )
  }

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
