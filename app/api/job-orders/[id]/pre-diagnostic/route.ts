import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — returns the most recent pre-diagnostic round for a job order, or null.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await db.query(`SELECT * FROM get_pre_diagnostic($1)`, [id])
    return NextResponse.json({ success: true, data: result.rows[0] ?? null })
  } catch (error) {
    console.error('Pre-diagnostic fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST — creates a new pre-diagnostic round ("send for approval"). There's
// no database function for this yet, so we insert directly.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { notes } = await request.json()

    const result = await db.query(
      `
      INSERT INTO pre_diagnostics (job_order_id, mechanic_notes, customer_approval_status, datetime_created)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING *
      `,
      [id, notes ?? '']
    )

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Pre-diagnostic create error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}