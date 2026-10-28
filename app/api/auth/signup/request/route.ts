import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { sendSignupCodeEmail } from '@/lib/mail'
import { 
  validateSignupFields, makeCode, hashCode, clientIp, 
  CODE_TTL_MINUTES, MAX_SENDS_PER_EMAIL_PER_HOUR, MAX_SENDS_PER_IP_PER_HOUR, RESEND_SECONDS 
} from '@/lib/emailSignup'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    
    // 1. Validate fields
    const valid = validateSignupFields(body)
    if (!valid.success) {
      return NextResponse.json({ success: false, field: valid.field, message: valid.message }, { status: 400 })
    }
    const { firstName, lastName, email, password } = valid.data

    // 2. Check employees
    const emp = await db.query(`SELECT id FROM employees WHERE LOWER(email) = $1`, [email])
    if (emp.rows.length > 0) {
      return NextResponse.json({ success: false, message: "This email can't be used to sign up. Use another email." }, { status: 409 })
    }

    // 3. Check users
    const usr = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email])
    if (usr.rows.length > 0) {
      return NextResponse.json({ success: false, code: 'EMAIL_REGISTERED', message: 'This email already has an account. Log in, continue with Google, or use Forgot password.' }, { status: 409 })
    }

    // 4. Limits
    const ip = clientIp(req)
    
    const emailLog = await db.query(
      `SELECT count(*) FROM signup_email_log WHERE email = $1 AND sent_at > (NOW() AT TIME ZONE 'Asia/Manila') - interval '1 hour'`,
      [email]
    )
    if (parseInt(emailLog.rows[0].count, 10) >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
      return NextResponse.json({ success: false, message: 'Too many codes were sent. Try again in an hour.' }, { status: 429 })
    }

    const ipLog = await db.query(
      `SELECT count(*) FROM signup_email_log WHERE ip = $1 AND sent_at > (NOW() AT TIME ZONE 'Asia/Manila') - interval '1 hour'`,
      [ip]
    )
    if (parseInt(ipLog.rows[0].count, 10) >= MAX_SENDS_PER_IP_PER_HOUR) {
      return NextResponse.json({ success: false, message: 'Too many codes were sent. Try again in an hour.' }, { status: 429 })
    }

    // The 60-second wait is checked in SQL (both times are Manila time):
    const waitCheck = await db.query(`
      SELECT 1 FROM pending_signups 
      WHERE email = $1 AND last_sent_at > (NOW() AT TIME ZONE 'Asia/Manila') - interval '${RESEND_SECONDS} seconds'
    `, [email])
    if (waitCheck.rows.length > 0) {
      return NextResponse.json({ success: false, message: 'Please wait a minute before asking for another code.' }, { status: 429 })
    }

    // 5. Create code, hash, upsert
    let code: string
    let hashedCode: string
    try {
      code = makeCode()
      hashedCode = hashCode(email, code)
    } catch (err: any) {
      console.error(err)
      return NextResponse.json({ success: false, message: 'We could not send your code right now. Try again in a few minutes.' }, { status: 500 })
    }
    const hashedPass = await hashPassword(password)

    await db.query(`
      INSERT INTO pending_signups (email, first_name, last_name, password_hash, code_hash, attempts, expires_at, last_sent_at, created_at)
      VALUES ($1, $2, $3, $4, $5, 0, (NOW() AT TIME ZONE 'Asia/Manila') + interval '${CODE_TTL_MINUTES} minutes', (NOW() AT TIME ZONE 'Asia/Manila'), (NOW() AT TIME ZONE 'Asia/Manila'))
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        password_hash = EXCLUDED.password_hash,
        code_hash = EXCLUDED.code_hash,
        attempts = 0,
        expires_at = EXCLUDED.expires_at,
        last_sent_at = EXCLUDED.last_sent_at
    `, [email, firstName, lastName, hashedPass, hashedCode])

    // 6. Send email
    try {
      await sendSignupCodeEmail({ to: email, name: firstName, code, minutes: CODE_TTL_MINUTES })
      
      // Clear old logs and insert new
      await db.query(`DELETE FROM signup_email_log WHERE sent_at < (NOW() AT TIME ZONE 'Asia/Manila') - interval '1 day'`)
      await db.query(`INSERT INTO signup_email_log (email, ip, sent_at) VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Manila'))`, [email, ip])
      
      return NextResponse.json({ success: true, email, resendInSeconds: RESEND_SECONDS })
    } catch (mailErr) {
      console.error('Mail err:', mailErr)
      await db.query(`DELETE FROM pending_signups WHERE email = $1`, [email])
      return NextResponse.json({ success: false, message: 'We could not send the email. Check the address and try again.' }, { status: 502 })
    }
  } catch (err: any) {
    console.error('Signup request err:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
