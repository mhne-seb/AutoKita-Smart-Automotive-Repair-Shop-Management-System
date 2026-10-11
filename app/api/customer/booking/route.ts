import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { DIAGNOSTIC_SCAN_SERVICE_NAME, DIAGNOSTIC_SCAN_FEE, bookingNeedsScan } from '@/data/diagnosticScan'
import { ROAD_TEST_TITLE } from '@/data/roadTest'
import { buildConcernText, MAX_SELECTED_SERVICES, NOTES_MAX_LENGTH, NOTE_MIN_WHEN_NO_SERVICE } from '@/lib/bookingServices'
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from '@/lib/plate'
import { getOccupiedBookingSlots, isSlotOccupiedInDb } from '@/lib/bookingSlots'
import { CUSTOMER_SESSION_COOKIE, createSessionToken, sessionCookieOptions, sessionSecretConfigured } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const { occupiedByDate, slots } = await getOccupiedBookingSlots()
    return NextResponse.json(
      { success: true, occupiedByDate, slots },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    )
  } catch (err: any) {
    console.error('[/api/customer/booking GET] error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve occupied slots', error: err?.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireCustomer()
    if (!guard.ok) return NextResponse.json({ success: false, message: 'Please log in to book a service.' }, { status: 401 })
    const finalUserId = guard.session.userId

    const body = await req.json()
    const {
      vehicleId,
      newVehicleDetails,
      serviceMode,
      homeAddress,
      customerConcern,
      diagnosticScanAuthorized,
      preferredDatetime,
      serviceIds,
      packageId,
      notSure,
      customerNote,
    } = body

    const bad =(message: string, code?: string) =>
      NextResponse.json({ success: false, message, ...(code ? { code } : {}) }, { status: 400 })

    if (!vehicleId && !newVehicleDetails) return bad('Missing vehicle information')

    let finalConcern = ''
    if (Array.isArray(serviceIds)) {
      const ids: number[] = Array.from(
        new Set(
          serviceIds
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        )
      )
      if (ids.length > MAX_SELECTED_SERVICES) {
        return bad('Too many services selected.')
      }

      let selectedNames: string[] = []
      if (ids.length > 0) {
        const sRes = await db.query(
          `SELECT id, service_name FROM services WHERE id = ANY($1::int[]) AND is_active = true`,
          [ids]
        )
        if (sRes.rows.length !== ids.length) {
          return bad('One of the selected services is no longer available. Please reload and pick again.')
        }
        for (const row of sRes.rows) {
          if (row.service_name === DIAGNOSTIC_SCAN_SERVICE_NAME || row.service_name === ROAD_TEST_TITLE) {
            return bad('One of the selected services is no longer available. Please reload and pick again.')
          }
        }
        const nameById = new Map<number, string>(sRes.rows.map((r: any) => [Number(r.id), String(r.service_name)]))
        selectedNames = ids.map((id) => nameById.get(id)!).filter(Boolean)
      }

      let packageName: string | null = null
      let packageServiceNames: string[] = []
      if (packageId !== undefined && packageId !== null) {
        const parsedPkgId = Number(packageId)
        if (!Number.isInteger(parsedPkgId) || parsedPkgId <= 0) {
          return bad('That package is no longer available. Please reload and pick again.')
        }
        const pkgRes = await db.query(
          `SELECT p.package_name, s.service_name
           FROM service_packages p
           JOIN service_package_items i ON i.package_id = p.id
           JOIN services s ON s.id = i.service_id
           WHERE p.id = $1 AND p.is_active = true
           ORDER BY i.sort_order`,
          [parsedPkgId]
        )
        if (pkgRes.rows.length === 0) {
          return bad('That package is no longer available. Please reload and pick again.')
        }
        packageName = pkgRes.rows[0].package_name
        packageServiceNames = pkgRes.rows.map((r: any) => r.service_name)
      }

      const note = String(customerNote ?? '').trim()
      if (note.length > NOTES_MAX_LENGTH) {
        return bad('Notes are too long (500 characters at most).')
      }

      const isNotSure = notSure === true
      if (!(ids.length >= 1 || isNotSure || note.length >= NOTE_MIN_WHEN_NO_SERVICE)) {
        return bad('Pick at least one service, choose "Not sure", or describe the problem in the notes.')
      }

      if (bookingNeedsScan(isNotSure, selectedNames) && diagnosticScanAuthorized !== true) {
        return bad('Please agree to the diagnostic scan fee to continue.', 'SCAN_FEE_NOT_AGREED')
      }

      finalConcern = buildConcernText({
        packageName,
        packageServiceNames,
        selectedNames,
        notSure: isNotSure,
        customerNote: note,
      })
    } else {
      finalConcern = String(customerConcern ?? '').slice(0, 1500)
    }

    let finalVehicleId = vehicleId
    if (finalVehicleId) {
      const ownVeh = await db.query(`SELECT 1 FROM vehicles WHERE id = $1 AND user_id = $2`, [finalVehicleId, finalUserId])
      if (ownVeh.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Forbidden: not your vehicle' }, { status: 403 })
      }

      // A car that is already in the shop cannot be booked again until its job is released
      // or cancelled. The screens hide the button; this is the real check.
      const openJob = await db.query(
        `SELECT 1 FROM job_orders WHERE vehicle_id = $1 AND status NOT IN ('released', 'cancelled') LIMIT 1`,
        [finalVehicleId],
      )
      if (openJob.rows.length > 0) {
        return NextResponse.json(
          { success: false, code: 'VEHICLE_IN_SERVICE', message: 'This car is already in the shop. You can book again after this job is done.' },
          { status: 409 },
        )
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

    // ---- 2. Write everything in ONE transaction -------------------------------
    // Vehicle, ticket and the scan consent are saved together or not at all, so a
    // failure can never leave a half-made booking.
    let ticket: any
    const client = await db.connect()
    try {
      await client.query('BEGIN')

      if (newVehicle) {
        const vehicleResult = await client.query(
          `INSERT INTO vehicles (user_id, vehicle_make, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [finalUserId, newVehicle.make, newVehicle.model, newVehicle.year, newVehicle.plate, newVehicle.type, newVehicle.mileage],
        )
        finalVehicleId = vehicleResult.rows[0].id
      }

      if (preferredDatetime) {
        const slotOccupied = await isSlotOccupiedInDb(preferredDatetime, client)
        if (slotOccupied) {
          await client.query('ROLLBACK')
          return NextResponse.json(
            {
              success: false,
              code: 'SLOT_TAKEN',
              message: 'This time slot is already booked. Please choose another date or time.',
            },
            { status: 409 },
          )
        }
      }

      // Call SQL function to create ticket (6 arguments including preferred_datetime)
      const ticketResult = await client.query(`SELECT * FROM create_service_ticket($1, $2, $3, $4, $5, $6)`, [
        finalUserId,
        finalVehicleId,
        mappedServiceMode,
        address,
        finalConcern || 'No specific concerns',
        preferredDatetime || null,
      ])
      ticket = ticketResult.rows[0]

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

    const res = NextResponse.json({
      success: true,
      ticket,
      userId: finalUserId,
    })

    if (sessionSecretConfigured() && finalUserId) {
      try {
        const session = { userId: finalUserId, role: 'customer' as const }
        const token = await createSessionToken(session)
        res.cookies.set(CUSTOMER_SESSION_COOKIE, token, sessionCookieOptions)
      } catch (tokenErr) {
        console.error('Failed to create customer session token:', tokenErr)
      }
    }

    return res
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
