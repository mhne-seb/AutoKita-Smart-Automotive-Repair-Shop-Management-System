import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
    const { userId, firstName, lastName, nickname, contactNumber, email, currentPassword, newPassword } = body

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing userId' }, { status: 400 })
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
      if (check.rows[0].password !== currentPassword) {
        return NextResponse.json({ success: false, code: 'BAD_PASSWORD', message: 'Current password is incorrect.' }, { status: 400 })
      }
      await db.query(`UPDATE users SET password = $1 WHERE id = $2`, [newPassword, userId])
    }

    // Profile fields.
    if ([firstName, lastName, nickname, contactNumber, email].some((v) => v !== undefined)) {
      if (email) {
        const taken = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2`,
          [email, userId],
        )
        if (taken.rows.length > 0) {
          return NextResponse.json({ success: false, code: 'EMAIL_TAKEN', message: 'That email is already in use.' }, { status: 409 })
        }
      }
      await db.query(
        `UPDATE users SET
           first_name     = COALESCE($2, first_name),
           last_name      = COALESCE($3, last_name),
           nickname       = COALESCE($4, nickname),
           contact_number = COALESCE($5, contact_number),
           email          = COALESCE($6, email)
         WHERE id = $1`,
        [userId, firstName ?? null, lastName ?? null, nickname ?? null, contactNumber ?? null, email ?? null],
      )
    }

    const { rows } = await db.query(SELECT_USER, [userId])
    return NextResponse.json({ success: true, user: rows[0] })
  } catch (err: any) {
    console.error('Profile update error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: err.message }, { status: 500 })
  }
}