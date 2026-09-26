import { NextResponse } from 'next/server'
import { isVerificationBypassed, setVerificationBypassed } from '@/lib/testMode'

export async function GET() {
  return NextResponse.json({
    bypassVerification: isVerificationBypassed(),
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (typeof body.bypassVerification === 'boolean') {
      setVerificationBypassed(body.bypassVerification)
      return NextResponse.json({ success: true, bypassVerification: body.bypassVerification })
    }
    return NextResponse.json({ success: false, message: 'Invalid boolean value' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to update' }, { status: 500 })
  }
}
