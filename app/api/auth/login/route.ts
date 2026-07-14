import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 })
    }

    // Directly query the users table for authentication
    const { rows } = await db.query(
      `SELECT * FROM get_authenticate_user($1, $2)`,
      [email, password]
    )

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid email or password.' }, { status: 401 })
    }

    const user = rows[0]
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      role: user.role 
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
