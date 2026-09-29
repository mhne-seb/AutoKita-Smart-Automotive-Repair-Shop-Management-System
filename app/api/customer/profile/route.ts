import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/password'

const SELECT_USER = `
  SELECT id, first_name, last_name, nickname, email, contact_number, address
  FROM users WHERE id = $1`

export async function GET(req: NextRequest) {
  const userId = parseInt(req.nextUrl.searchParams.get('userId') || '', 10)
  if (isNaN(userId)) {
    return NextResponse.json({ success: false, message: 'userId must be a number' }, { status: 400 })
  }
  const { rows } = await db.query(SELECT_USER, [userId])
  if (rows.length === 0) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, user: rows[0] })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, firstName, lastName, nickname, currentPassword, newPassword } = body

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing userId' }, { status: 400 })
    }

    // Email and contact number are where login links and approval codes go, so
    // only the shop changes them, after checking it's really the customer.
    // Refused here (not just hidden on the page) because anyone can call this
    // route directly.
    if (body.email !== undefined || body.contactNumber !== undefined) {
      return NextResponse.json(
        { success: false, code: 'LOCKED_FIELD', message: 'To change your email or contact number, please contact the shop.' },
        { status: 403 },
      )
    }

    // Password change — only runs when a newPassword is supplied.
    if (newPassword) {
      if (String(newPassword).length < 8) {
        return NextResponse.json({ success: false, message: 'New password must be at least 8 characters.' }, { status: 400 })
      }
      const check = await db.query(`SELECT password FROM users WHERE id = $1`, [userId])
      if (check.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      }
      if (!(await verifyPassword(String(currentPassword ?? ''), check.rows[0].password))) {
        return NextResponse.json({ success: false, code: 'BAD_PASSWORD', message: 'Current password is incorrect.' }, { status: 400 })
      }
      await db.query(`UPDATE users SET password = $1 WHERE id = $2`, [await hashPassword(newPassword), userId])
    }

    // Profile fields.
    if ([firstName, lastName, nickname].some((v) => v !== undefined)) {
      await db.query(
        `UPDATE users SET
           first_name = COALESCE($2, first_name),
           last_name  = COALESCE($3, last_name),
           nickname   = COALESCE($4, nickname)
         WHERE id = $1`,
        [userId, firstName ?? null, lastName ?? null, nickname ?? null],
      )
    }

    const { rows } = await db.query(SELECT_USER, [userId])
    return NextResponse.json({ success: true, user: rows[0] })
  } catch (err: any) {
    console.error('Profile update error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: err.message }, { status: 500 })
  }
}