import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper: get or create the vehicle_inspections header row for a job order.
// All findings hang off this parent via inspection_id.
async function getOrCreateInspectionId(jobOrderId: string): Promise<number> {
  const res = await db.query(
    `SELECT id FROM vehicle_inspections WHERE job_order_id = $1 LIMIT 1`,
    [jobOrderId],
  )
  if (res.rows.length > 0) return res.rows[0].id as number

  const inserted = await db.query(
    `INSERT INTO vehicle_inspections (job_order_id, started_at) VALUES ($1, NOW()) RETURNING id`,
    [jobOrderId],
  )
  return inserted.rows[0].id as number
}

// Translate UI finding status ('needs-attention') → DB ENUM ('needs_attention')
function toDbStatus(s: string): string {
  if (s === 'needs-attention') return 'needs_attention'
  if (s === 'urgent') return 'urgent'
  return 'ok'
}

// Translate DB ENUM back to UI status
function toUiStatus(s: string): string {
  if (s === 'needs_attention') return 'needs-attention'
  return s
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const body = await request.json()
    const { name, note, status, photo } = body

    const inspectionId = await getOrCreateInspectionId(jobOrderId)

    const result = await db.query(
      `INSERT INTO inspection_photos (inspection_id, title, note, status, photo_url, logged_at)
       VALUES ($1, $2, $3, $4::finding_status, $5, NOW())
       RETURNING *`,
      [inspectionId, name ?? '', note ?? '', toDbStatus(status || 'ok'), photo || null],
    )

    const row = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        name: row.title,
        description: row.note,
        findings_description: row.note,
        photo: row.photo_url,
        status: toUiStatus(row.status),
      },
    })
  } catch (error) {
    console.error('Add finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
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
      `UPDATE inspection_photos p
       SET title     = COALESCE($1, p.title),
           note      = COALESCE($2, p.note),
           status    = COALESCE($3::finding_status, p.status),
           photo_url = COALESCE($4, p.photo_url)
       FROM vehicle_inspections vi
       WHERE p.inspection_id = vi.id
         AND vi.job_order_id = $5
         AND p.id = $6
       RETURNING p.*`,
      [
        name ?? null,
        note ?? null,
        status ? toDbStatus(status) : null,
        photo ?? null,
        jobOrderId,
        findingId,
      ],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 })
    }

    const row = result.rows[0]
    return NextResponse.json({
      success: true,
      data: {
        ...row,
        name: row.title,
        description: row.note,
        findings_description: row.note,
        photo: row.photo_url,
        status: toUiStatus(row.status),
      },
    })
  } catch (error) {
    console.error('Update finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
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
      `DELETE FROM inspection_photos p
       USING vehicle_inspections vi
       WHERE p.inspection_id = vi.id
         AND vi.job_order_id = $1
         AND p.id = $2
       RETURNING p.id`,
      [jobOrderId, findingId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Delete finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
