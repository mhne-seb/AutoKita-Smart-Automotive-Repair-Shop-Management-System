import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId,
      vehicleId,
      newVehicleDetails,
      serviceMode,
      homeAddress,
      customerConcern
    } = body

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing user ID' }, { status: 400 })
    }
    if (!vehicleId && !newVehicleDetails) {
      return NextResponse.json({ success: false, message: 'Missing vehicle information' }, { status: 400 })
    }

    let finalVehicleId = vehicleId

    // Insert new vehicle if necessary
    if (newVehicleDetails) {
      const { model, year, plate, type, mileage } = newVehicleDetails
      // Ensure plate is provided
      if (!plate) {
        return NextResponse.json({ success: false, message: 'License plate is required for new vehicles' }, { status: 400 })
      }
      
      const insertQuery = `
        INSERT INTO vehicles (user_id, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `
      const vehicleResult = await db.query(insertQuery, [
        userId,
        model || 'Unknown',
        parseInt(year) || 2026,
        plate,
        type || 'Sedan',
        parseFloat(mileage) || 0
      ])
      finalVehicleId = vehicleResult.rows[0].id
    }

    const mappedServiceMode = serviceMode === 'Home Service' ? 'home_service' : 'walk_in'
    const address = mappedServiceMode === 'home_service' ? (homeAddress || 'None') : 'None'

    // Call SQL function to create ticket
    const ticketQuery = `SELECT * FROM create_service_ticket($1, $2, $3, $4, $5)`
    const ticketResult = await db.query(ticketQuery, [
      userId,
      finalVehicleId,
      mappedServiceMode,
      address,
      customerConcern || 'No specific concerns'
    ])

    return NextResponse.json({
      success: true,
      ticket: ticketResult.rows[0]
    })
  } catch (err: any) {
    console.error('Booking error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
