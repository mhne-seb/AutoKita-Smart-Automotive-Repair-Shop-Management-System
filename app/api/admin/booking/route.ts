import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from '@/lib/plate'
import {
  EMAIL_RE, PHONE_RE, MAX_NAME, MAX_MODEL, MAX_EMAIL, MAX_MILEAGE,
  cleanPhone, maxVehicleYear, parseMileage, splitFullName,
} from '@/lib/bookingRules'

// Walk-in "New Ticket" (staff books for a customer standing at the counter).
// Same rules as the customer's online booking: everything is checked BEFORE
// anything is written, then the account, vehicle, ticket and audit entry are
// saved together or not at all (one transaction).

const SERVICE_MODES: Record<string, 'walk_in' | 'home_service'> = { 'Shop Visit': 'walk_in', 'Home Service': 'home_service' }

export async function POST(req: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response

  const bad = (message: string, field?: string, status = 400) =>
    NextResponse.json({ success: false, message, ...(field ? { field } : {}) }, { status })

  let t: Record<string, unknown>
  try {
    const body = await req.json()
    t = body?.ticketData
  } catch {
    return bad('Missing ticket data')
  }
  if (!t || typeof t !== 'object') return bad('Missing ticket data')

  // ---- 1. Validate every input (the screen checks these too; this is the real check) ----
  const name = splitFullName(t.fullName)
  if (!name) return bad("Enter the customer's first and last name.", 'fullName')
  if (name.first.length > MAX_NAME || name.last.length > MAX_NAME) return bad(`Each name can be up to ${MAX_NAME} characters.`, 'fullName')

  const email = String(t.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL) return bad('Enter a valid email address.', 'email')

  const phone = cleanPhone(t.contactNumber)
  if (!PHONE_RE.test(phone)) return bad('Enter a valid mobile number, like 09171234567.', 'contactNumber')

  const modelText = String(t.vehicleModel ?? '').trim()
  if (!modelText || modelText.length > MAX_MODEL) return bad(`Enter the vehicle model (up to ${MAX_MODEL} characters).`, 'vehicleModel')

  const yearNum = Number(t.year)
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > maxVehicleYear()) return bad('Enter a valid vehicle year.', 'year')

  const mileage = parseMileage(t.mileage)
  if (mileage === null) return bad(`Enter the mileage as a number from 0 to ${MAX_MILEAGE.toLocaleString('en-PH')} km.`, 'mileage')

  const cleanPlate = normalizePlateNumber(String(t.licensePlate ?? ''))
  if (!cleanPlate || !isValidPlateNumber(cleanPlate)) return bad(PLATE_FORMAT_ERROR_MESSAGE, 'licensePlate')

  const transmission = String(t.transmission ?? '').trim()
  if (!['Manual', 'Automatic', 'CVT'].includes(transmission)) return bad('Choose the transmission.', 'transmission')

  const serviceCategory = String(t.serviceCategory ?? '').trim()
  if (!serviceCategory || serviceCategory.length > 100) return bad('Choose a service category.', 'serviceCategory')

  const serviceMode = SERVICE_MODES[String(t.pickupOption ?? '')]
  if (!serviceMode) return bad('Choose Shop Visit or Home Service.', 'pickupOption')

  const place = ['barangay', 'city', 'province'].map((k) => String(t[k] ?? '').trim())
  if (place.some((p) => p.length > 100)) return bad('The address is too long.', 'province')
  if (serviceMode === 'home_service' && place.some((p) => !p)) return bad('A home service needs the barangay, city and province.', 'province')
  const address = serviceMode === 'home_service' ? place.join(', ') : 'None'

  try {
    // ---- 2. Look up what already exists (read only) ----
    const found = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email])
    let userId: number | null = found.rows[0]?.id ?? null

    const veh = await db.query(`SELECT id, user_id FROM vehicles WHERE UPPER(plate_number) = UPPER($1)`, [cleanPlate])
    let vehicleId: number | null = veh.rows[0]?.id ?? null
    // A plate belongs to one customer. Never put a ticket for this customer on someone else's car.
    if (vehicleId !== null && (userId === null || Number(veh.rows[0].user_id) !== Number(userId))) {
      return bad('This plate is already registered to another customer. Check the plate number.', 'licensePlate', 409)
    }

    // Hashing is slow, so do it before the transaction opens. The temporary
    // password is only ever stored hashed.
    const passwordHash = userId === null
      ? await hashPassword(`temp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-6)}`)
      : null

    // ---- 3. Write everything in ONE transaction ----
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      if (userId === null) {
        const created = await client.query(
          `INSERT INTO users (first_name, last_name, nickname, contact_number, email, password, registration_date)
           VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
          [name.first, name.last, name.first, phone, email, passwordHash],
        )
        userId = created.rows[0].id
      }

      if (vehicleId === null) {
        const created = await client.query(
          `INSERT INTO vehicles (user_id, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [userId, modelText, yearNum, cleanPlate, transmission, mileage],
        )
        vehicleId = created.rows[0].id
      }

      const ticketResult = await client.query(
        `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5)`,
        [userId, vehicleId, serviceMode, address, serviceCategory],
      )
      const newTicket = ticketResult.rows[0]

      // Who created it: part of the same transaction, so a ticket without its record cannot exist.
      const emp = await client.query(`SELECT full_name FROM employees WHERE id = $1`, [auth.session.userId])
      await client.query(
        `INSERT INTO system_audit_logs (employees_id, action_performed, entity_type, entity_id, new_values, action_date)
         VALUES ($1, 'created', 'service_tickets', $2, $3, NOW())`,
        [
          auth.session.userId,
          newTicket?.id,
          JSON.stringify({
            ticket_id: newTicket?.id,
            customer_name: `${name.first} ${name.last}`,
            vehicle_plate: cleanPlate,
            service_mode: serviceMode,
            service_category: serviceCategory,
            created_by: emp.rows[0]?.full_name ?? 'Shop Administrator',
          }),
        ],
      )

      await client.query('COMMIT')
      return NextResponse.json({ success: true, ticket: newTicket })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('Admin booking error:', err)
    // Someone else saved the same email or plate between our check and our write.
    if (err?.code === '23505') {
      const plate = String(err.constraint ?? '').includes('plate')
      return bad(plate ? 'This plate was just registered. Please check the plate number.' : 'This email was just registered. Please try again.', plate ? 'licensePlate' : 'email', 409)
    }
    if (err?.code === '23514' && err?.constraint === 'vehicles_plate_number_format') return bad(PLATE_FORMAT_ERROR_MESSAGE, 'licensePlate')
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: err?.message } : {}) },
      { status: 500 },
    )
  }
}
