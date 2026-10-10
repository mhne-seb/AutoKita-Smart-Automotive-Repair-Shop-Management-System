import { NextRequest, NextResponse } from 'next/server'
import { getCustomerSession, getStaffSession } from '@/lib/session'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  if (role !== 'customer' && role !== 'staff') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const session = role === 'customer' ? await getCustomerSession() : await getStaffSession()
  if (!session || session.role !== role) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  try {
    if (role === 'customer') {
      const user = await db.query(
        `SELECT nickname, first_name, last_name, email FROM users WHERE id = $1 LIMIT 1`,
        [session.userId]
      )
      if (user.rows.length === 0) return NextResponse.json({ success: false }, { status: 401 })
      const row = user.rows[0]
      const name = row.nickname || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email
      
      return NextResponse.json({
        success: true,
        role: 'customer',
        userId: session.userId,
        name,
        title: null
      }, { headers: { 'Cache-Control': 'no-store' } })
    } else {
      const emp = await db.query(
        `SELECT full_name, role::text as role_str FROM employees WHERE id = $1 LIMIT 1`,
        [session.userId]
      )
      if (emp.rows.length === 0) return NextResponse.json({ success: false }, { status: 401 })
      const row = emp.rows[0]
      const title = String(row.role_str ?? 'staff').split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      
      return NextResponse.json({
        success: true,
        role: 'admin',
        userId: session.userId,
        name: row.full_name,
        title
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
  } catch (err) {
    console.error('Google profile route error:', err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
