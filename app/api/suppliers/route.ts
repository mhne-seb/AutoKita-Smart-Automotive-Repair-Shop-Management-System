import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Suppliers are only ever created from the "Record purchase" modal on Service
// Progress (there's no dedicated suppliers screen yet), so a name is all that's
// required — the rest of the columns can be filled in later if a page for it
// is ever built.

export async function GET() {
  try {
    const result = await db.query(
      `SELECT id, supplier_name AS name
       FROM suppliers
       WHERE is_active IS DISTINCT FROM false
       ORDER BY supplier_name ASC`,
    )
    return NextResponse.json({ success: true, suppliers: result.rows })
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ success: false, message: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()
    const trimmed = String(name ?? '').trim()
    if (!trimmed) {
      return NextResponse.json({ success: false, message: 'Supplier name is required' }, { status: 400 })
    }

    // Same name typed twice shouldn't make two suppliers.
    const existing = await db.query(
      `SELECT id, supplier_name AS name FROM suppliers WHERE LOWER(supplier_name) = LOWER($1) LIMIT 1`,
      [trimmed],
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: true, supplier: existing.rows[0] })
    }

    const result = await db.query(
      `INSERT INTO suppliers (supplier_name, is_active)
       VALUES ($1, true)
       RETURNING id, supplier_name AS name`,
      [trimmed],
    )
    return NextResponse.json({ success: true, supplier: result.rows[0] })
  } catch (error) {
    console.error('Error adding supplier:', error)
    return NextResponse.json({ success: false, message: 'Failed to add supplier' }, { status: 500 })
  }
}
