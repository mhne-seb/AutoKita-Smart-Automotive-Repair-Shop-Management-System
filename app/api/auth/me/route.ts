import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// Who the server thinks you are, based only on the signed cookie.
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ success: false, session: null }, { status: 401 })
  return NextResponse.json({ success: true, session })
}
