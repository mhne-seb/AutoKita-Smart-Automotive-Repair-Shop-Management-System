import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Tells the booking form whether this license plate is already registered to a
// vehicle. If it is, the customer is asked to log in first instead of booking
// as a guest (see app/(customer)/book/page.tsx, step 2).

export async function GET(req: NextRequest) {
  try {
    const plate = req.nextUrl.searchParams.get('plate')?.trim()

    if (!plate) {
      return NextResponse.json({ success: false, message: 'Missing plate' }, { status: 400 })
    }

    const found = await db.query(
      `SELECT id FROM vehicles WHERE UPPER(plate_number) = UPPER($1) LIMIT 1`,
      [plate]
    )

    return NextResponse.json({ success: true, exists: found.rows.length > 0 })
  } catch (err: any) {
    console.error('check-plate error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}