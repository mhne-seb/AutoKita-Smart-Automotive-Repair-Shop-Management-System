import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 })
  }

  try {
    let result = await db.query(
      'SELECT id, email, nickname, first_name, last_name, role FROM users WHERE email = $1 AND password = $2',
      [email, password]
    )

    if (result.rows.length === 0) {
      result = await db.query(
        "SELECT id, email, full_name as nickname, split_part(full_name, ' ', 1) as first_name, split_part(full_name, ' ', 2) as last_name, role FROM employees WHERE email = $1 AND password = $2",
        [email, password]
      )
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }

    const user = result.rows[0]
    return NextResponse.json({
      success: true,
      user,
      role: user.role?.trim() || 'customer',
    })
  } catch (err) {
    console.error('Login query failed:', err)
    return NextResponse.json({ success: false, message: 'Something went wrong.' }, { status: 500 })
  }
}
