import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const result = await db.query(`
      SELECT DISTINCT ON (service_name) id, service_name, description, base_price, base_duration_hours, is_price_fixed 
      FROM services 
      WHERE is_active = true 
      ORDER BY service_name ASC
    `)
    return NextResponse.json({ success: true, services: result.rows })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch services' }, { status: 500 })
  }
}
