import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const res = await db.query(`
      SELECT 
        s.id,
        s.name,
        s.address,
        s.contact_number,
        s.email,
        s.operating_hours,
        e.full_name AS owner_name,
        e.email AS owner_email
      FROM shops s
      LEFT JOIN employees e ON e.id = s.owner_id
      ORDER BY s.id ASC
      LIMIT 1
    `)

    if (res.rows.length === 0) {
      return NextResponse.json({
        success: true,
        shop: {
          name: 'AutoKita Smart Automotive Repair Shop',
          address: '123 Main St, Metro Manila, Philippines',
          contact_number: '09123456789',
          email: 'contact@autokita.com',
          operating_hours: null,
          owner_name: 'John Doe',
        }
      })
    }

    const row = res.rows[0]
    return NextResponse.json({
      success: true,
      shop: {
        name: row.name || 'AutoKita Smart Automotive Repair Shop',
        address: row.address || '123 Main St, Metro Manila, Philippines',
        contact_number: row.contact_number || '09123456789',
        email: row.email || 'contact@autokita.com',
        operating_hours: row.operating_hours,
        owner_name: row.owner_name || 'John Doe',
      }
    })
  } catch (error: any) {
    console.error('Shop fetch error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch shop info',
      debug: error.message,
    }, { status: 500 })
  }
}
