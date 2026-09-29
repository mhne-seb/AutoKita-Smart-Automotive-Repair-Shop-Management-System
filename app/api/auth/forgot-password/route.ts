import { NextRequest, NextResponse } from 'next/server'
import { createResetToken, findAccountByEmail, RESET_LINK_MINUTES } from '@/lib/passwordReset'
import { sendPasswordResetEmail } from '@/lib/mail'

// Always gives the same answer, whether or not the email has an account, so a
// stranger can't use this form to find out who the shop's customers are.
const SAME_ANSWER = { success: true, message: 'If that email has an AutoKita account, we sent a reset link to it.' }

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ success: false, message: 'Enter a valid email address.' }, { status: 400 })
  }

  try {
    const account = await findAccountByEmail(email.trim())
    if (account) {
      // The link's address comes from our own setting, never from the request's
      // Host header — otherwise someone could make us email a link to their site.
      const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const resetUrl = `${base}/reset-password?token=${createResetToken(account)}`
      await sendPasswordResetEmail({ to: account.email, name: account.name, resetUrl, expiresMinutes: RESET_LINK_MINUTES })
    }
    return NextResponse.json(SAME_ANSWER)
  } catch (err) {
    console.error('Forgot password failed:', err)
    return NextResponse.json({ success: false, message: "We couldn't send the email right now. Try again in a few minutes." }, { status: 500 })
  }
}
