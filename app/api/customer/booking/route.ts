import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { sendTempPasswordEmail } from '@/lib/mail'
import { hashPassword } from '@/lib/password'
import { DIAGNOSTIC_SCAN_SERVICE_NAME, DIAGNOSTIC_SCAN_FEE } from '@/data/diagnosticScan'
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from '@/lib/plate'
import { EMAIL_RE, PHONE_RE } from '@/lib/bookingRules'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId,
      customer,          // { name, email, phone } — used when nobody is logged in
      vehicleId,
      newVehicleDetails,
      serviceMode,
      homeAddress,
      customerConcern,
      diagnosticScanAuthorized,
      preferredDatetime,
    } = body

    const bad =(message: string, code?: string) =>
      NextResponse.json({ success: false, message, ...(code ? { code } : {}) }, { status: 400 })

    if (!vehicleId && !newVehicleDetails) return bad('Missing vehicle information')

    // Resolve the customer: use the logged-in id when we have one, otherwise
    // find them by email or create the account — same as the admin booking route.
    let finalUserId = userId

    if (finalUserId) {
      const guard = await requireCustomer(finalUserId)
      if (!guard.ok) return guard.response
      finalUserId = guard.session.userId
    }

    // ---- 1. Check everything BEFORE writing anything --------------------------
    // (The forms check these too; this is the real check, on the server.)
    let guest: { email: string; firstName: string; lastName: string; nickname: string; phone: string; address: string | null } | null = null
    if (!finalUserId) {
      const email = String(customer?.email ?? '').trim().toLowerCase()
      if (!EMAIL_RE.test(email)) return bad('Enter a valid email address.')
      const firstName = String(customer?.firstName ?? '').trim()
      const lastName = String(customer?.lastName ?? '').trim()
      if (!firstName || firstName.length > 50) return bad('Enter your first name (up to 50 characters).')
      if (!lastName || lastName.length > 50) return bad('Enter your last name (up to 50 characters).')
      const phone = String(customer?.phone ?? '').replace(/[\s-]/g, '')
      if (!PHONE_RE.test(phone)) return bad('Enter a valid mobile number, like 09171234567.')
      const nickname = String(customer?.nickname ?? '').trim().slice(0, 50) || firstName
      const address = customer?.address ? String(customer.address).trim().slice(0, 200) : null

      const found = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email])
      if (found.rows.length > 0) {
        return NextResponse.json(
          { success: false, code: 'EMAIL_REGISTERED', message: 'This email already has an account. Please log in to book.' },
          { status: 409 },
        )
      }
      guest = { email, firstName, lastName, nickname, phone, address }
    }

    let finalVehicleId = vehicleId
    if (finalUserId && finalVehicleId) {
      const ownVeh = await db.query(`SELECT 1 FROM vehicles WHERE id = $1 AND user_id = $2`, [finalVehicleId, finalUserId])
      if (ownVeh.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Forbidden: not your vehicle' }, { status: 403 })
      }
    }

    let newVehicle: { make: string | null; model: string; year: number; plate: string; type: string; mileage: number } | null = null
    if (!finalVehicleId && newVehicleDetails) {
      const { make, model, year, plate, type, mileage } = newVehicleDetails
      if (!plate) return bad('License plate is required for new vehicles')
      const cleanPlate = normalizePlateNumber(plate)
      if (!isValidPlateNumber(cleanPlate)) return bad(PLATE_FORMAT_ERROR_MESSAGE, 'INVALID_PLATE_FORMAT')

      const modelText = String(model ?? '').trim()
      if (!modelText || modelText.length > 40) return bad('Enter the vehicle model (up to 40 characters).')
      const yearNum = Number(year)
      if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) return bad('Enter a valid vehicle year.')
      const mileageNum = Number(mileage === '' || mileage == null ? 0 : mileage)
      if (!Number.isFinite(mileageNum) || mileageNum < 0 || mileageNum > 1_000_000) return bad('Enter a valid mileage (0 to 1,000,000 km).')

      const existingVeh = await db.query(`SELECT id FROM vehicles WHERE UPPER(plate_number) = UPPER($1)`, [cleanPlate])
      if (existingVeh.rows.length > 0) {
        return NextResponse.json(
          { success: false, code: 'PLATE_REGISTERED', message: 'This vehicle is already registered. Please log in to book service for it.' },
          { status: 409 },
        )
      }
      newVehicle = { make: make ? String(make).trim() : null, model: modelText, year: yearNum, plate: cleanPlate, type: type || 'Sedan', mileage: mileageNum }
    }

    const mappedServiceMode = serviceMode === 'Home Service' ? 'home_service' : 'walk_in'
    const address = mappedServiceMode === 'home_service' ? (homeAddress || 'None') : 'None'

    // Readable copy stays in tempPassword for the welcome email below;
    // only the hash goes into the database. (Hashing is slow, so do it before
    // opening the transaction.)
    let tempPassword: string | null = null
    let passwordHash: string | null = null
    if (guest) {
      tempPassword = `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-6)}`
      passwordHash = await hashPassword(tempPassword)
    }

    // ---- 2. Write everything in ONE transaction -------------------------------
    // Account, vehicle, ticket and the scan consent are saved together or not
    // at all, so a failure can never leave an account nobody was told about.
    let accountEmailed = false
    let ticket: any
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      if (guest) {
        const created = await client.query(
          `INSERT INTO users (first_name, last_name, nickname, contact_number, email, address, password, registration_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [guest.firstName, guest.lastName, guest.nickname, guest.phone, guest.email, guest.address, passwordHash],
        )
        finalUserId = created.rows[0].id
      }

      if (newVehicle) {
        const vehicleResult = await client.query(
          `INSERT INTO vehicles (user_id, vehicle_make, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [finalUserId, newVehicle.make, newVehicle.model, newVehicle.year, newVehicle.plate, newVehicle.type, newVehicle.mileage],
        )
        finalVehicleId = vehicleResult.rows[0].id
      }

      // Call SQL function to create ticket (6 arguments including preferred_datetime)
      const ticketResult = await client.query(`SELECT * FROM create_service_ticket($1, $2, $3, $4, $5, $6)`, [
        finalUserId,
        finalVehicleId,
        mappedServiceMode,
        address,
        customerConcern || 'No specific concerns',
        preferredDatetime || null,
      ])
      ticket = ticketResult.rows[0]

      // Documented consent to the OBD-II scan fee. service_tickets has no column
      // for it and create_service_ticket() takes no flag, so it's an audit event
      // against the ticket — who agreed, to what, and when. The admin queue and
      // the job-order creation step both read this back, keyed on user_id being
      // set: accepting the ticket writes an 'approved' row too, but by an employee.
      if (diagnosticScanAuthorized === true) {
        await client.query(
          `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
           VALUES ($1, 'approved'::audit_action_enum, 'service_tickets', $2, $3, NOW())`,
          [finalUserId, ticket.id, `${DIAGNOSTIC_SCAN_SERVICE_NAME} fee (PHP ${DIAGNOSTIC_SCAN_FEE}) authorized at booking`],
        )
      }

      await client.query('COMMIT')
    } catch (txErr) {
      try { await client.query('ROLLBACK') } catch { /* connection already gone */ }
      throw txErr
    } finally {
      client.release()
    }

    // New guest customer — email the temp password together with a booking copy.
    // Only after the save went through.
    if (tempPassword && guest) {
      try {
        await sendTempPasswordEmail({
          to: guest.email,
          name: guest.firstName,
          tempPassword,
          booking: {
            reference: `AC-${ticket.id}-${new Date().getFullYear()}`,
            vehicle: newVehicleDetails
              ? `${newVehicleDetails.make || ''} ${newVehicleDetails.model || ''} ${newVehicleDetails.year || ''} — ${newVehicleDetails.plate || ''}`.trim()
              : '—',
            serviceMode: serviceMode || '—',
            details: customerConcern || 'No specific concerns',
          },
        })
        accountEmailed = true
      } catch (mailErr) {
        console.error('Temp password email failed:', mailErr)
      }
    }

    return NextResponse.json({
      success: true,
      ticket,
      accountEmailed,
    })
  } catch (err: any) {
    console.error('Booking error:', err)
    if (err?.code === '23514' && err?.constraint === 'vehicles_plate_number_format') {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PLATE_FORMAT',
          message: PLATE_FORMAT_ERROR_MESSAGE,
        },
        { status: 400 }
      )
    }
    // Two people booking with the same email/plate at the same moment: the
    // database's unique rule stops the second one; answer it in plain words.
    if (err?.code === '23505') {
      const detail = String(err?.detail ?? '')
      if (detail.includes('email')) {
        return NextResponse.json({ success: false, code: 'EMAIL_REGISTERED', message: 'This email already has an account. Please log in to book.' }, { status: 409 })
      }
      if (detail.includes('plate')) {
        return NextResponse.json({ success: false, code: 'PLATE_REGISTERED', message: 'This vehicle is already registered. Please log in to book service for it.' }, { status: 409 })
      }
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: err.message } : {}) },
      { status: 500 }
    )
  }
}
