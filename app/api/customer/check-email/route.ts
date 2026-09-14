import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Tells the booking form whether this email already belongs to a registered
// account. If it does, the customer is asked to log in first instead of
// booking as a guest (see app/(customer)/book/page.tsx, step 1).

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ success: false, message: 'Missing email' }, { status: 400 })
    }

    const found = await db.query(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    )

    return NextResponse.json({ success: true, exists: found.rows.length > 0 })
  } catch (err: any) {
    console.error('check-email error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
