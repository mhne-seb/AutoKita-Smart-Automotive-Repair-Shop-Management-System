import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { issueOtp, OTP_TTL_MINUTES, FINDING_OTP_PURPOSE } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/mail'

// Step 1 of approving a mid-service finding — same shape as the quotation
// OTP: email a 6-digit code, hand back a signed token bound to this customer
// and this finding. Declining needs no code; only approving adds to the bill.

function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(3, user.length - 1))}@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    const { userId, findingId } = await request.json()
    if (!userId || !findingId) {
      return NextResponse.json({ success: false, message: 'Missing userId or findingId' }, { status: 400 })
    }

    // Ownership: the finding's job order must belong to this customer, and it
    // must still be waiting on them.
    const f = await db.query(
      `SELECT f.decision::text, jo.user_id, jo.id AS job_order_id
       FROM service_findings f JOIN job_orders jo ON jo.id = f.job_order_id
       WHERE f.id = $1`,
      [findingId],
    )
    const finding = f.rows[0]
    if (!finding) return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 })
    if (finding.user_id !== userId) return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 })
    if (finding.decision !== 'pending') {
      return NextResponse.json({ success: false, message: 'This finding has already been answered.' }, { status: 409 })
    }

    const u = await db.query(`SELECT email, first_name, nickname FROM users WHERE id = $1`, [userId])
    const user = u.rows[0]
    if (!user?.email) return NextResponse.json({ success: false, message: 'No email on file' }, { status: 400 })

    const { code, token, expiresAt } = issueOtp(FINDING_OTP_PURPOSE, `${userId}:${findingId}`)

    const mailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
    let devCode: string | undefined
    if (mailConfigured) {
      await sendOtpEmail({
        to: user.email,
        name: user.first_name || user.nickname || 'there',
        code,
        expiresMinutes: OTP_TTL_MINUTES,
        context: `approve the additional work on Job Order #JO-${finding.job_order_id}`,
      })
    } else {
      console.warn(`[findings/otp] GMAIL creds not set — OTP for finding ${findingId} is ${code}`)
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
    console.error('[/api/tracking/in-progress/findings/otp] error:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, message: msg.includes('OTP_SECRET') ? msg : 'Could not send the code' }, { status: 500 })
  }
}
