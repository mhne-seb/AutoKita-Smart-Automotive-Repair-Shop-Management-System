import { NextRequest, NextResponse } from 'next/server'
import { readSignupCookie } from '@/lib/googleAuth'

export async function GET(req: NextRequest) {
  const cookieStr = req.cookies.get('autokita_google_signup')?.value
  const data = await readSignupCookie(cookieStr)

  if (!data) {
    return NextResponse.json({ success: false, message: 'Missing or expired signup cookie' }, { status: 401 })
  }

  return NextResponse.json(
    { success: true, email: data.email, firstName: data.firstName, lastName: data.lastName },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
