import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 })
    }

    //from lm ace: added "Capstone-Testing". in here because my database from pg admin because it cannot search directly in my specified schema 
    const { rows: employeeRows } = await db.query(
      `SELECT id, full_name, email, role FROM "Capstone-Testing".employees WHERE email = $1`,
      [email]
    )

    if (employeeRows.length > 0) {
      const employee = employeeRows[0]
      return NextResponse.json({ 
        success: true, 
        user: {
          id: employee.id,
          email: employee.email,
          name: employee.full_name,
        },
        role: 'admin' 
      })
    }

    if (!password) {
      return NextResponse.json({ success: false, message: 'Password is required' }, { status: 400 })
    }

    //from lm ace: added "Capstone-Testing". in here because my database from pg admin because it cannot search directly in my specified schema 
    const { rows } = await db.query(
      `SELECT * FROM "Capstone-Testing".get_authenticate_user($1, $2)`,
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
  } 

  catch (error) {
  console.error('Login error:', error)
  return NextResponse.json(
    { 
      success: false, 
      message: 'Internal server error',
      // ⚠️ TEMPORARY - remove before deploying to production
      debug: error instanceof Error ? error.message : String(error)
    }, 
    { status: 500 }
  )
}
  /*
  catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }*/
}
