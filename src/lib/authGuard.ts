import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getStaffSession, getCustomerSession } from './session'
import { db } from './db'

export type AuthResult = 
  | { ok: true; session: { userId: number; role: 'customer' | 'staff' } }
  | { ok: false; response: NextResponse }

export async function requireStaff(): Promise<AuthResult> {
  const session = await getStaffSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
  }
  if (session.role !== 'staff') {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Staff only.' }, { status: 403 }) }
  }
  return { ok: true, session }
}

export async function requireStaffOrApiKey(request: Request, envName: string): Promise<AuthResult> {
  const expected = process.env[envName] ?? ''
  const sent = request.headers.get('x-api-key') ?? ''
  if (expected && sent) {
    const a = Buffer.from(sent)
    const b = Buffer.from(expected)
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { ok: true, session: { userId: 0, role: 'staff' } }
    }
  }
  return requireStaff()
}

export async function requireCustomer(claimedUserId?: number | string | null): Promise<AuthResult> {
  const session = await getCustomerSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
  }
  if (session.role !== 'customer') {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 }) }
  }
  if (claimedUserId != null && Number(claimedUserId) !== session.userId) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Not your account.' }, { status: 403 }) }
  }
  return { ok: true, session }
}

export async function requireStaffOrJobOrderOwner(jobOrderId: number): Promise<AuthResult> {
  // Staff check first
  const staffSession = await getStaffSession()
  if (staffSession && staffSession.role === 'staff') {
    return { ok: true, session: staffSession }
  }

  // Customer owner check second
  const customerSession = await getCustomerSession()
  if (customerSession && customerSession.role === 'customer') {
    const res = await db.query('SELECT user_id FROM job_orders WHERE id = $1', [jobOrderId])
    if (res.rows.length === 0) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'Job order not found.' }, { status: 404 }) }
    }
    if (res.rows[0].user_id !== customerSession.userId) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'Not your account.' }, { status: 403 }) }
    }
    return { ok: true, session: customerSession }
  }

  return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
}
