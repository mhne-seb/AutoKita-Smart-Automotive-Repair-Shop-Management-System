import { NextRequest, NextResponse } from 'next/server'
import { getSession, getStaffSession, getCustomerSession } from '@/lib/session'

// Who the server thinks you are, based on the signed cookies.
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role')
  let session = null

  if (role === 'staff' || role === 'admin') {
    session = await getStaffSession()
  } else if (role === 'customer') {
    session = await getCustomerSession()
  } else {
    const referer = req.headers.get('referer') || ''
    if (referer.includes('/dashboard') || referer.includes('/book')) {
      session = (await getCustomerSession()) || (await getStaffSession())
    } else if (
      referer.includes('/overview') ||
      referer.includes('/job-orders') ||
      referer.includes('/job-queue') ||
      referer.includes('/analytics') ||
      referer.includes('/history') ||
      referer.includes('/mechanics') ||
      referer.includes('/sales-payroll') ||
      referer.includes('/database')
    ) {
      session = (await getStaffSession()) || (await getCustomerSession())
    } else {
      session = await getSession()
    }
  }

  if (!session) return NextResponse.json({ success: false, session: null }, { status: 401 })
  return NextResponse.json({ success: true, session })
}
