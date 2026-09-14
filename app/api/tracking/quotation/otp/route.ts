import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { issueOtp, OTP_TTL_MINUTES, QUOTATION_OTP_PURPOSE } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/mail'

// Step 1 of confirming a quotation: email the customer a 6-digit code and
// hand the browser a signed token to present alongside it. The confirm
// endpoint checks the pair. Purpose + subject are baked into the token so a
// code issued for one job order can't approve a different one.

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const shown = user.slice(0, 1)
  return `${shown}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    const { userId, jobOrderId } = await request.json()
    if (!userId || !jobOrderId) {
      return NextResponse.json({ success: false, message: 'Missing userId or jobOrderId' }, { status: 400 })
    }

    // Ownership — a customer can only confirm their own job order.
    const joRes = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
    const jobOrder = joRes.rows[0]
    if (!jobOrder) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    if (jobOrder.user_id !== userId) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    if (jobOrder.quotation_approved) {
      return NextResponse.json({ success: false, message: 'This quotation is already confirmed.' }, { status: 409 })
    }

    const userRes = await db.query(`SELECT email, first_name, nickname FROM users WHERE id = $1`, [userId])
    const user = userRes.rows[0]
    if (!user?.email) return NextResponse.json({ success: false, message: 'No email on file' }, { status: 400 })

    const { code, token, expiresAt } = issueOtp(QUOTATION_OTP_PURPOSE, `${userId}:${jobOrderId}`)

    // Email is the delivery channel. If the shop's mail creds aren't set up in
    // this environment, the code is logged so local testing still works —
    // and, outside production only, returned so the tester doesn't need to
    // read the server console.
    const mailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
    let devCode: string | undefined
    if (mailConfigured) {
      await sendOtpEmail({
        to: user.email,
        name: user.first_name || user.nickname || 'there',
        code,
        expiresMinutes: OTP_TTL_MINUTES,
        context: `confirm the quotation for Job Order #JO-${jobOrderId}`,
      })
    } else {
      console.warn(`[quotation/otp] GMAIL creds not set — OTP for JO-${jobOrderId} is ${code}`)
      if (process.env.NODE_ENV !== 'production') devCode = code
    }

    return NextResponse.json({
      success: true,
      token,
      sentTo: maskEmail(user.email),
      expiresAt,
      expiresMinutes: OTP_TTL_MINUTES,
      ...(devCode ? { devCode } : {}),
    })
  } catch (err) {
    console.error('[/api/tracking/quotation/otp] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    // Surface the OTP_SECRET misconfiguration clearly — it's a setup problem, not a runtime one.
    return NextResponse.json({ success: false, message: msg.includes('OTP_SECRET') ? msg : 'Could not send the code' }, { status: 500 })
  }
}
