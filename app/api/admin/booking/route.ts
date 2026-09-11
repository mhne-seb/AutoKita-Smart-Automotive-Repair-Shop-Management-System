import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { ticketData } = body

    if (!ticketData) {
      return NextResponse.json({ success: false, message: 'Missing ticket data' }, { status: 400 })
    }

    // 1. Handle User creation / lookup
    const nameParts = (ticketData.fullName || '').trim().split(' ')
    const firstName = nameParts[0] || 'Unknown'
    const lastName = nameParts.slice(1).join(' ') || 'Customer'
    
    let userId;
    const checkUser = await db.query(`SELECT id FROM users WHERE email = $1`, [ticketData.email])
    
    if (checkUser.rows.length > 0) {
      userId = checkUser.rows[0].id
    } else {
        // users.password is UNIQUE in the schema, so one shared default only works
      // for the first walk-in. Give each new customer their own temporary password.
      const tempPassword = `temp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString().slice(-6)}`

      // 7 target columns and 7 expressions (including NOW())
      const insUser = await db.query(
        `INSERT INTO users (first_name, last_name, nickname, contact_number, email, password, registration_date) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
        [
          firstName, 
          lastName, 
          firstName, // Fallback for nickname
          ticketData.contactNumber, 
          ticketData.email, 
          tempPassword
        ]
      )
      userId = insUser.rows[0].id
    }

    // 2. Find or insert the vehicle.
    // vehicles.plate_number is UNIQUE, so reuse the car if it is already
    // registered — same lookup-then-insert we do for the user above.
    let vehicleId
    const checkVeh = await db.query(
      `SELECT id FROM vehicles WHERE plate_number = $1`,
      [ticketData.licensePlate]
    )

    if (checkVeh.rows.length > 0) {
      vehicleId = checkVeh.rows[0].id
    } else {
      const vehResult = await db.query(
        `INSERT INTO vehicles (user_id, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          userId,
          ticketData.vehicleModel || 'Unknown',
          parseInt(ticketData.year) || 2026,
          ticketData.licensePlate,
          ticketData.transmission || 'Automatic',
          parseFloat(ticketData.mileage) || 0
        ]
      )
      vehicleId = vehResult.rows[0].id
    }

    // 3. Create Service Ticket using your database procedure
    const mappedServiceMode = ticketData.pickupOption === 'Home Service' ? 'home_service' : 'walk_in'
    
    const fullAddress = `${ticketData.barangay || ''}, ${ticketData.city || ''}, ${ticketData.province || ''}`.trim()
    const address = mappedServiceMode === 'home_service' ? (fullAddress || 'None') : 'None'
    
    // We pass exactly 5 arguments to match your create_service_ticket function
    const ticketQuery = `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5)`
    const ticketResult = await db.query(ticketQuery, [
      userId,
      vehicleId,
      mappedServiceMode,
      address,
      ticketData.serviceCategory || 'General Service'
    ])

    return NextResponse.json({ 
      success: true,
      ticket: ticketResult.rows[0]
    })

  } catch (err: any) {
    console.error('Admin booking error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}