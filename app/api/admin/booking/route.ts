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
          'admin_created_123'
        ]
      )
      userId = insUser.rows[0].id
    }

    // 2. Insert Vehicle
    // 6 target columns and 6 expressions ($1 to $6)
    const vehQuery = `
      INSERT INTO vehicles (user_id, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `
    const vehResult = await db.query(vehQuery, [
      userId,
      ticketData.vehicleModel || 'Unknown',
      parseInt(ticketData.year) || 2026,
      ticketData.licensePlate,
      ticketData.transmission || 'Automatic',
      parseFloat(ticketData.mileage) || 0
    ])
    const vehicleId = vehResult.rows[0].id

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