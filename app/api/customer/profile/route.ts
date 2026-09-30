import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { hashPassword, verifyPassword } from '@/lib/password'
import { signFileUrl } from '@/lib/storage'
import { logCustomerAccountChange } from '@/lib/audit'

const SELECT_USER = `
  SELECT id, first_name, last_name, nickname, email, contact_number, address, avatar_url
  FROM users WHERE id = $1`

// The photo is in a private bucket, so the page gets a link that expires.
async function withPhotoLink(user: Record<string, any>) {
  return { ...user, avatar_url: await signFileUrl(user.avatar_url) }
}

export async function GET(req: NextRequest) {
  const userIdParam = req.nextUrl.searchParams.get('userId')
  const guard = await (userIdParam ? requireCustomer(parseInt(userIdParam, 10)) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId
  const { rows } = await db.query(SELECT_USER, [userId])
  if (rows.length === 0) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, user: await withPhotoLink(rows[0]) })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId: userIdRaw, firstName, lastName, nickname, address, currentPassword, newPassword } = body

    const guard = await (userIdRaw ? requireCustomer(Number(userIdRaw)) : requireCustomer())
    if (!guard.ok) return guard.response
    const userId = guard.session.userId

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
      // Only the fact that it changed — never the password itself.
      await logCustomerAccountChange(userId, { password: 'hidden' }, { password: 'changed' })
    }

    if (address !== undefined && String(address).trim().length > 200) {
      return NextResponse.json({ success: false, message: 'Please keep your address under 200 characters.' }, { status: 400 })
    }

    // Kept to log what the customer changed (see the end of this function).
    const before = await db.query(SELECT_USER, [userId])
    if (before.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
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

    // Home address — used for home-service visits. Unlike email/phone it
    // carries no codes, so the customer may change it. Blank clears it.
    if (address !== undefined) {
      await db.query(`UPDATE users SET address = $2 WHERE id = $1`, [userId, String(address).trim() || null])
    }

    const { rows } = await db.query(SELECT_USER, [userId])
    // "None" is what older bookings stored for no address — same as blank.
    const fields = (u: Record<string, unknown>) => ({
      first_name: u.first_name,
      last_name: u.last_name,
      nickname: u.nickname,
      address: u.address === 'None' ? null : u.address,
    })
    await logCustomerAccountChange(userId, fields(before.rows[0]), fields(rows[0]))

    return NextResponse.json({ success: true, user: await withPhotoLink(rows[0]) })
  } catch (err: any) {
    console.error('Profile update error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: err.message }, { status: 500 })
  }
}