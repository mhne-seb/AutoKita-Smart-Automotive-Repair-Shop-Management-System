import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyCodeHash, MAX_ATTEMPTS } from '@/lib/emailSignup'
import { setSessionCookies } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const code = String(body.code || '').trim()

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 })
    }

    const pendingQuery = await db.query(
      `SELECT * FROM pending_signups WHERE email = $1`,
      [email]
    )
    
    if (pendingQuery.rows.length === 0) {
      return NextResponse.json({ success: false, code: 'EXPIRED', message: 'That code has expired. Ask for a new one.' }, { status: 400 })
    }

    const pending = pendingQuery.rows[0]
    // Expiry is compared in SQL, in Manila time, like every other time in this file.
    const isExpiredRes = await db.query(`SELECT $1::timestamp < (NOW() AT TIME ZONE 'Asia/Manila') as is_expired`, [pending.expires_at])
    if (isExpiredRes.rows[0].is_expired) {
      return NextResponse.json({ success: false, code: 'EXPIRED', message: 'That code has expired. Ask for a new one.' }, { status: 400 })
    }

    if (pending.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ success: false, code: 'TOO_MANY', message: 'Too many tries. Ask for a new code.' }, { status: 429 })
    }

    const isMatch = verifyCodeHash(email, code, pending.code_hash)
    if (!isMatch) {
      const up = await db.query(
        `UPDATE pending_signups SET attempts = attempts + 1 WHERE email = $1 RETURNING attempts`,
        [email]
      )
      const triesLeft = MAX_ATTEMPTS - up.rows[0].attempts
      return NextResponse.json({ success: false, code: 'WRONG', message: 'That code is not right. Check it and try again.', triesLeft }, { status: 400 })
    }

    // Success - create user
    let newUserId: number
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      
      const checkUser = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email])
      if (checkUser.rows.length > 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ success: false, code: 'EMAIL_REGISTERED', message: 'This email already has an account. Log in, continue with Google, or use Forgot password.' }, { status: 409 })
      }

      const nickname = pending.first_name.slice(0, 40)
      
      const res = await client.query(`
        INSERT INTO users (first_name, last_name, nickname, contact_number, email, password, registration_date, setup_completed_at)
        VALUES ($1, $2, $3, '', $4, $5, NOW(), NULL)
        RETURNING id
      `, [pending.first_name.slice(0, 40), pending.last_name.slice(0, 40), nickname, email, pending.password_hash])
      
      newUserId = res.rows[0].id

      await client.query(`DELETE FROM pending_signups WHERE email = $1`, [email])
      await client.query('COMMIT')
    } catch (txErr: any) {
      try { await client.query('ROLLBACK') } catch { }
      if (txErr.code === '23505') {
        return NextResponse.json({ success: false, code: 'EMAIL_REGISTERED', message: 'This email already has an account. Log in, continue with Google, or use Forgot password.' }, { status: 409 })
      }
      throw txErr
    } finally {
      client.release()
    }

    const response = NextResponse.json({ success: true, userId: newUserId, name: pending.first_name })
    await setSessionCookies(response, { userId: newUserId, role: 'customer' }, false)
    return response

  } catch (err: any) {
    console.error('Signup verify err:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
