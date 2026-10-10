import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from '@/lib/plate'

export async function GET(request: NextRequest) {
  const guard = await requireCustomer()
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  try {
    const res = await db.query(
      `SELECT v.id, v.vehicle_make as make, v.vehicle_model as model, v.vehicle_year as year, v.plate_number as plate, v.vehicle_type as transmission, v.mileage,
              (SELECT jo.id FROM job_orders jo WHERE jo.vehicle_id = v.id AND jo.status NOT IN ('released', 'cancelled') ORDER BY jo.id DESC LIMIT 1) as active_job_order_id
       FROM vehicles v
       WHERE v.user_id = $1
       ORDER BY v.id DESC`,
      [userId]
    )

    const vehicles = res.rows.map(row => ({
      id: row.id,
      make: row.make,
      model: row.model,
      year: row.year,
      plate: row.plate,
      transmission: row.transmission,
      mileage: Number(row.mileage),
      inService: row.active_job_order_id !== null,
      activeJobOrderId: row.active_job_order_id
    }))

    return NextResponse.json({ success: true, vehicles })
  } catch (error) {
    console.error('Customer vehicles GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireCustomer()
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  try {
    const body = await request.json()
    const plateRaw = String(body.plate || '')
    const make = String(body.make || '').substring(0, 40)
    const model = String(body.model || '').substring(0, 40)
    const yearRaw = parseInt(body.year, 10)
    const transmission = String(body.transmission || '')
    const mileageRaw = Number(body.mileage)

    if (!plateRaw) {
      return NextResponse.json({ success: false, message: 'License plate is required.' }, { status: 400 })
    }

    const cleanPlate = normalizePlateNumber(plateRaw)
    if (!isValidPlateNumber(cleanPlate)) {
      return NextResponse.json({ success: false, code: 'INVALID_PLATE_FORMAT', message: PLATE_FORMAT_ERROR_MESSAGE }, { status: 400 })
    }

    if (!model.trim()) {
      return NextResponse.json({ success: false, message: 'Vehicle model is required.' }, { status: 400 })
    }

    if (isNaN(yearRaw) || yearRaw < 1900 || yearRaw > new Date().getFullYear() + 1) {
      return NextResponse.json({ success: false, message: 'Invalid year.' }, { status: 400 })
    }

    if (isNaN(mileageRaw) || mileageRaw < 0 || mileageRaw > 1000000) {
      return NextResponse.json({ success: false, message: 'Invalid mileage.' }, { status: 400 })
    }

    if (!['Automatic', 'Manual', 'CVT', 'Semi-Automatic'].includes(transmission)) {
      return NextResponse.json({ success: false, message: 'Invalid transmission.' }, { status: 400 })
    }

    const checkPlate = await db.query(`SELECT id FROM vehicles WHERE UPPER(plate_number) = UPPER($1) LIMIT 1`, [cleanPlate])
    if (checkPlate.rows.length > 0) {
      return NextResponse.json({ success: false, code: 'PLATE_REGISTERED', message: 'This vehicle is already registered. If it is yours, contact the shop.' }, { status: 409 })
    }

    const insertRes = await db.query(
      `INSERT INTO vehicles (user_id, vehicle_make, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, vehicle_make, vehicle_model, vehicle_year, plate_number, vehicle_type, mileage`,
      [userId, make, model, yearRaw.toString(), cleanPlate, transmission, mileageRaw.toString()]
    )

    const row = insertRes.rows[0]

    return NextResponse.json({
      success: true,
      vehicle: {
        id: row.id,
        make: row.vehicle_make,
        model: row.vehicle_model,
        year: row.vehicle_year,
        plate: row.plate_number,
        transmission: row.vehicle_type,
        mileage: Number(row.mileage)
      }
    })
  } catch (error: any) {
    console.error('Customer vehicles POST error:', error)
    if (error.code === '23505') {
      return NextResponse.json({ success: false, code: 'PLATE_REGISTERED', message: 'This vehicle is already registered. If it is yours, contact the shop.' }, { status: 409 })
    } else if (error.code === '23514') {
      return NextResponse.json({ success: false, code: 'INVALID_PLATE_FORMAT', message: PLATE_FORMAT_ERROR_MESSAGE }, { status: 400 })
    }
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
