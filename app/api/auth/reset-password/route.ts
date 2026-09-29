import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { checkResetToken } from '@/lib/passwordReset'
import { sendPasswordChangedEmail } from '@/lib/mail'

const LINK_PROBLEM = {
  expired: 'This link has expired. Ask for a new one from the sign-in page.',
  invalid: "This link doesn't work anymore. It may have been used already. Ask for a new one from the sign-in page.",
}

// Lets the reset page tell the customer the link is dead BEFORE they type a new password.
export async function GET(req: NextRequest) {
  const result = await checkResetToken(req.nextUrl.searchParams.get('token') ?? '')
  if (!result.ok) return NextResponse.json({ success: false, message: LINK_PROBLEM[result.reason] })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}))
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ success: false, message: 'Your new password needs at least 8 characters.' }, { status: 400 })
  }

  try {
    const result = await checkResetToken(String(token ?? ''))
    if (!result.ok) {
      return NextResponse.json({ success: false, message: LINK_PROBLEM[result.reason] }, { status: 400 })
    }

    const { account } = result
    const table = account.kind === 'customer' ? 'users' : 'employees'
    await db.query(`UPDATE ${table} SET password = $1 WHERE id = $2`, [await hashPassword(password), account.id])

    // The password is already saved; a failed heads-up email shouldn't undo that.
    await sendPasswordChangedEmail({ to: account.email, name: account.name }).catch((err) =>
      console.error('Password-changed email failed:', err),
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reset password failed:', err)
    return NextResponse.json({ success: false, message: "We couldn't save your new password. Try again." }, { status: 500 })
  }
}
