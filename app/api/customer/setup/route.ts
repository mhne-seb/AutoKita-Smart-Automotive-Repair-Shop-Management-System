import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { PHONE_RE, cleanPhone } from '@/lib/bookingRules'

export const dynamic = 'force-dynamic'

// What the new-account setup (/setup) and the dashboard reminder need, worked out from the
// database for the signed-in customer. A customer finishes the setup with a valid phone and at
// least one vehicle; the address only moves the profile percentage.

const LOCAL_PHONE_RE = /^09\d{9}$/

/** 09XXXXXXXXX from 09.., 639.. or +639.. (users.contact_number is varchar(11)). */
function toLocalPhone(raw: unknown): string | null {
  const v = cleanPhone(raw)
  if (!PHONE_RE.test(v)) return null
  const local = v.startsWith('+63') ? '0' + v.slice(3) : v.startsWith('63') ? '0' + v.slice(2) : v
  return LOCAL_PHONE_RE.test(local) ? local : null
}

async function buildStatus(userId: number) {
  const userRes = await db.query(
    `SELECT first_name, nickname, contact_number, address, setup_completed_at, password
       FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  )
  if (userRes.rows.length === 0) return null
  const user = userRes.rows[0]

  const link = await db.query(
    `SELECT 1 FROM auth_identities WHERE account_type = 'customer' AND account_id = $1 LIMIT 1`,
    [userId],
  )
  const vehiclesRes = await db.query(
    `SELECT id, vehicle_make AS make, vehicle_model AS model, vehicle_year AS year, plate_number
       FROM vehicles WHERE user_id = $1 ORDER BY id ASC`,
    [userId],
  )
  const vehicles = vehiclesRes.rows

  const phone: string = user.contact_number || ''
  const phoneValid = LOCAL_PHONE_RE.test(phone)
  const hasVehicle = vehicles.length > 0

  let setupCompleted = user.setup_completed_at !== null
  // A customer who already has a vehicle and a valid phone (for example one made by the old
  // guest booking) is never sent through the setup: mark it finished now.
  if (!setupCompleted && hasVehicle && phoneValid) {
    await db.query(
      `UPDATE users SET setup_completed_at = (NOW() AT TIME ZONE 'Asia/Manila')
        WHERE id = $1 AND setup_completed_at IS NULL`,
      [userId],
    )
    setupCompleted = true
  }

  const address = user.address && user.address !== 'None' ? String(user.address) : null
  const items = {
    account: true,
    // A Google link, or a password (the temporary one was emailed to that address).
    email: link.rows.length > 0 || user.password !== null,
    phone: phoneValid,
    address: address !== null,
    // One circle for both: the contact details are done when the phone AND the address are saved.
    contact: phoneValid && address !== null,
    vehicle: hasVehicle,
  }
  // Four steps, 25% each: account, email, phone and address, vehicle.
  const percent = [items.account, items.email, items.contact, items.vehicle].filter(Boolean).length * 25

  return {
    success: true,
    setupCompleted,
    percent,
    items,
    firstName: user.nickname || user.first_name || '',
    phone,
    address,
    vehicles: vehicles.map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      plate: v.plate_number,
    })),
  }
}

export async function GET(_req: NextRequest) {
  try {
    const auth = await requireCustomer()
    if (!auth.ok) return auth.response

    const status = await buildStatus(auth.session.userId)
    if (!status) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 })
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Setup status error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// Body is one of:
//   { phone }           save the mobile number, ONLY while the account has none yet
//   { complete: true }  finish the setup (needs a valid phone, an address and at least one vehicle)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireCustomer()
    if (!auth.ok) return auth.response
    const userId = auth.session.userId

    const body = await req.json().catch(() => ({}))

    if (body.phone !== undefined) {
      const local = toLocalPhone(body.phone)
      if (!local) {
        return NextResponse.json(
          { success: false, message: 'Enter a valid mobile number, like 09171234567.' },
          { status: 400 },
        )
      }
      // The number is locked once it exists (the profile page tells the customer to contact the shop).
      const saved = await db.query(
        `UPDATE users SET contact_number = $2
          WHERE id = $1 AND (contact_number IS NULL OR contact_number = '')
          RETURNING id`,
        [userId, local],
      )
      if (saved.rows.length === 0) {
        const current = await db.query(`SELECT contact_number FROM users WHERE id = $1`, [userId])
        if (current.rows[0]?.contact_number !== local) {
          return NextResponse.json(
            { success: false, message: 'Your mobile number is already saved. To change it, contact the shop.' },
            { status: 409 },
          )
        }
      }
    }

    if (body.complete === true) {
      const check = await db.query(
        `SELECT u.contact_number, u.address,
                EXISTS (SELECT 1 FROM vehicles v WHERE v.user_id = u.id) AS has_vehicle
           FROM users u WHERE u.id = $1`,
        [userId],
      )
      const row = check.rows[0]
      if (!row || !LOCAL_PHONE_RE.test(row.contact_number || '')) {
        return NextResponse.json({ success: false, message: 'Add your mobile number to finish.' }, { status: 409 })
      }
      if (!row.address || row.address === 'None') {
        return NextResponse.json({ success: false, message: 'Add your address to finish.' }, { status: 409 })
      }
      if (!row.has_vehicle) {
        return NextResponse.json({ success: false, message: 'Add at least one vehicle to finish.' }, { status: 409 })
      }
      await db.query(
        `UPDATE users SET setup_completed_at = (NOW() AT TIME ZONE 'Asia/Manila')
          WHERE id = $1 AND setup_completed_at IS NULL`,
        [userId],
      )
    }

    const status = await buildStatus(userId)
    if (!status) return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 })
    return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Setup update error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
