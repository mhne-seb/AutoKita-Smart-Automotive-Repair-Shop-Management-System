import { NextRequest, NextResponse } from 'next/server'
import { getOccupiedBookingSlots } from '@/lib/bookingSlots'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const { occupiedByDate, slots } = await getOccupiedBookingSlots()
    return NextResponse.json(
      { success: true, occupiedByDate, slots },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  } catch (err: any) {
    console.error('[/api/customer/booking/occupied-slots] error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve occupied slots', error: err?.message },
      { status: 500 }
    )
  }
}
