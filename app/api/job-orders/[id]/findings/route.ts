import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    
    const { name, note, status, photo } = body

    const result = await db.query(
      `INSERT INTO vehicle_inspections (job_order_id, name, findings_description, status, photo, logged_date) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING *`,
      [jobOrderId, name || 'New finding', note || 'Describe what was found...', status || 'ok', photo || null]
    )

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Add finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    
    const { id: findingId, name, note, status, photo } = body

    if (!findingId) {
      return NextResponse.json({ success: false, message: 'Finding ID required' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE vehicle_inspections 
       SET name = COALESCE($1, name), 
           findings_description = COALESCE($2, findings_description), 
           status = COALESCE($3, status), 
           photo = COALESCE($4, photo)
       WHERE id = $5 AND job_order_id = $6
       RETURNING *`,
      [name ?? null, note ?? null, status ?? null, photo ?? null, findingId, jobOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Update finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const url = new URL(request.url)
    const findingId = url.searchParams.get('findingId')
    
    if (!findingId) {
      return NextResponse.json({ success: false, message: 'Finding ID required' }, { status: 400 })
    }

    const result = await db.query(
      `DELETE FROM vehicle_inspections WHERE id = $1 AND job_order_id = $2 RETURNING id`,
      [findingId, jobOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Delete finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
