import { NextRequest, NextResponse } from 'next/server'
import { sendAdminContactEmail } from '@/lib/mail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const inquiry = String(body.inquiry || 'General').trim()
    const message = String(body.message || '').trim()

    if (!name) {
      return NextResponse.json({ success: false, message: 'Please enter your full name.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ success: false, message: 'Please enter a valid email address.' }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ success: false, message: 'Please enter your inquiry message.' }, { status: 400 })
    }

    // Send email to admin: proserv.autokita@gmail.com
    await sendAdminContactEmail({
      name,
      email,
      inquiry,
      message,
    })

    return NextResponse.json({
      success: true,
      message: 'Inquiry sent successfully to admin.',
    })
  } catch (err: any) {
    console.error('Contact inquiry error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to send your inquiry. Please try again later.' },
      { status: 500 },
    )
  }
}

