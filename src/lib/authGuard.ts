import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
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

// For a route that a program (not a person) also calls, like the Gmail fetcher
// script. Lets in a logged-in staff member, OR a caller that sends the shared
// secret in the `X-API-Key` header. If the secret is not set on the server, the
// key path is always refused, so a forgotten setting can never open the door.
// The key path counts as staff with id 0 ("system").
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
