import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendTempPasswordEmail } from '@/lib/mail'

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
      customerConcern
    } = body

    if (!vehicleId && !newVehicleDetails) {
      return NextResponse.json({ success: false, message: 'Missing vehicle information' }, { status: 400 })
    }

    // Resolve the customer: use the logged-in id when we have one, otherwise
    // find them by email or create the account — same as the admin booking route.
    let finalUserId = userId
    let tempPassword: string | null = null
    let accountEmailed = false
    let newCustomerName = ''

    if (!finalUserId) {
      if (!customer?.email) {
        return NextResponse.json({ success: false, message: 'Missing customer email' }, { status: 400 })
      }

      const found = await db.query(`SELECT id FROM users WHERE email = LOWER($1)`, [customer.email])

      if (found.rows.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: 'EMAIL_REGISTERED',
            message: 'This email already has an account. Please log in to book.',
          },
          { status: 409 }
        )
      } else {
        const firstName = (customer.firstName || '').trim() || 'Unknown'
        const lastName = (customer.lastName || '').trim() || 'Customer'
        const nickname = (customer.nickname || '').trim() || firstName
        newCustomerName = firstName


        // users.password is UNIQUE, so every new account needs its own value.
        tempPassword = `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-6)}`

        const created = await db.query(
         `INSERT INTO users (first_name, last_name, nickname, contact_number, email, address, password, registration_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
          [firstName, lastName, nickname, customer.phone || '', customer.email, customer.address || null, tempPassword]
        )
        finalUserId = created.rows[0].id
      }
    }

    let finalVehicleId = vehicleId

    // Insert the vehicle only if this plate is not already registered.
    if (!finalVehicleId && newVehicleDetails) {
      const { make, model, year, plate, type, mileage } = newVehicleDetails
      if (!plate) {
        return NextResponse.json({ success: false, message: 'License plate is required for new vehicles' }, { status: 400 })
      }

      const existingVeh = await db.query(`SELECT id FROM vehicles WHERE UPPER(plate_number) = UPPER($1)`, [plate])

      if (existingVeh.rows.length > 0) {
        return NextResponse.json({
          success: false,
          code: 'PLATE_REGISTERED',
          message: 'This vehicle is already registered. Please log in to book service for it.',
        },
          { status: 409 })
      } else {
        const vehicleResult = await db.query(
          `INSERT INTO vehicles (user_id, vehicle_make, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [finalUserId, make || null, model || 'Unknown', parseInt(year) || 2026, plate, type || 'Sedan', parseFloat(mileage) || 0]
        )
        finalVehicleId = vehicleResult.rows[0].id
      }
    }

    const mappedServiceMode = serviceMode === 'Home Service' ? 'home_service' : 'walk_in'
    const address = mappedServiceMode === 'home_service' ? (homeAddress || 'None') : 'None'

    // Call SQL function to create ticket
    const ticketQuery = `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5)`
    const ticketResult = await db.query(ticketQuery, [
      finalUserId,
      finalVehicleId,
      mappedServiceMode,
      address,
      customerConcern || 'No specific concerns'
    ])

    const ticket = ticketResult.rows[0]

    // New guest customer — email the temp password together with a booking copy.
    if (tempPassword) {
      try {
        await sendTempPasswordEmail({
          to: customer.email,
          name: newCustomerName,
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
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
