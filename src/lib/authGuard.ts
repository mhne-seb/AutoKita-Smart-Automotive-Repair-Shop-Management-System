import { NextResponse } from 'next/server'
import { getSession } from './session'
import { db } from './db'

export type AuthResult = 
  | { ok: true; session: { userId: number; role: 'customer' | 'staff' } }
  | { ok: false; response: NextResponse }

export async function requireStaff(): Promise<AuthResult> {
  const session = await getSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
  }
  if (session.role !== 'staff') {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Staff only.' }, { status: 403 }) }
  }
  return { ok: true, session }
}

export async function requireCustomer(claimedUserId?: number | string | null): Promise<AuthResult> {
  const session = await getSession()
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
  const session = await getSession()
  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
  }
  if (session.role === 'staff') {
    return { ok: true, session }
  }
  if (session.role === 'customer') {
    const res = await db.query('SELECT user_id FROM job_orders WHERE id = $1', [jobOrderId])
    if (res.rows.length === 0) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'Job order not found.' }, { status: 404 }) }
    }
    if (res.rows[0].user_id !== session.userId) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'Not your account.' }, { status: 403 }) }
    }
    return { ok: true, session }
  }
  return { ok: false, response: NextResponse.json({ success: false, message: 'Please log in.' }, { status: 401 }) }
}
