import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'Email and password are required.' }, { status: 400 })
  }

  try {
    // Find the account by email only. The password check happens in code,
    // because a salted hash can't be compared inside the SQL.
    let isCustomer = true
    let result = await db.query(
      'SELECT id, email, nickname, first_name, last_name, role, password FROM users WHERE email = $1',
      [email]
    )
    if (result.rows.length === 0) {
      isCustomer = false
      result = await db.query(
        "SELECT id, email, full_name as nickname, split_part(full_name, ' ', 1) as first_name, split_part(full_name, ' ', 2) as last_name, role, password FROM employees WHERE email = $1",
        [email]
      )
    }

    const found = result.rows[0]
    if (!found || !(await verifyPassword(password, found.password))) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }

    // Never send the hash back to the browser.
    const user = { ...found }
    delete user.password
    const rawRole = user.role?.trim()?.toLowerCase()
    // Live database users.role is 'c' (or 'customer'). Employees have roles: owner, mechanic, etc.
    const resolvedRole = isCustomer || rawRole === 'c' || rawRole === 'customer' ? 'customer' : 'admin'

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        role: resolvedRole,
      },
      role: resolvedRole,
    })
  } catch (err) {
    console.error('Login query failed:', err)
    return NextResponse.json({ success: false, message: 'Something went wrong.' }, { status: 500 })
  }
}
