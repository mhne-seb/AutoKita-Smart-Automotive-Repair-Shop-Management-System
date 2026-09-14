import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadToBucket } from '@/lib/storage'

// Stores a walkaround reference photo into inspection_photos (child of
// vehicle_inspections). The inspection header row is created on first upload
// if it doesn't exist yet. Photos are identified by title, not slot_id.

const MAX_BYTES = 5 * 1024 * 1024 // matches the bucket's own 5MB limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const form = await request.formData()

    const file = form.get('file')
    const slotId = String(form.get('slotId') ?? '').trim()
    const label = String(form.get('label') ?? '').trim() || 'Inspection Photo'

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'No photo uploaded' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Photo must be a JPEG, PNG or WebP image' },
        { status: 415 },
      )
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: 'Photo must be under 5MB' }, { status: 413 })
    }

    const publicUrl = await uploadToBucket(jobOrderId, slotId || label, file)
    const inspectionId = await getOrCreateInspectionId(jobOrderId)
    const title = String(form.get('title') ?? label).trim() || 'Inspection Photo'
    const rowIdParam = form.get('rowId') ? Number(form.get('rowId')) : null

    let rowId: number
    if (rowIdParam) {
      await db.query(
        `UPDATE inspection_photos SET photo_url = $1, title = $2, logged_at = NOW() WHERE id = $3`,
        [publicUrl, title, rowIdParam],
      )
      rowId = rowIdParam
    } else {
      // Check if a photo with this title already exists (upsert by title)
      const existing = await db.query(
        `SELECT id FROM inspection_photos
         WHERE inspection_id = $1 AND title = $2
         LIMIT 1`,
        [inspectionId, title],
      )

      if (existing.rows.length > 0) {
        rowId = existing.rows[0].id
        await db.query(
          `UPDATE inspection_photos SET photo_url = $1, logged_at = NOW() WHERE id = $2`,
          [publicUrl, rowId],
        )
      } else {
        const inserted = await db.query(
          `INSERT INTO inspection_photos (inspection_id, title, photo_url, logged_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id`,
          [inspectionId, title, publicUrl],
        )
        rowId = inserted.rows[0].id
      }
    }

    return NextResponse.json({ success: true, url: publicUrl, id: rowId, title })
  } catch (error) {
    console.error('Photo upload error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        debug: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const { rowId, title, note } = await request.json()

    if (!rowId) {
      return NextResponse.json({ success: false, message: 'rowId is required' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE inspection_photos p
       SET title = COALESCE($1, p.title),
           note  = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE p.note END
       FROM vehicle_inspections vi
       WHERE p.inspection_id = vi.id
         AND vi.job_order_id = $3
         AND p.id = $4
       RETURNING p.id, p.title, p.note`,
      [
        title !== undefined ? (String(title).trim() || 'Inspection Photo') : null,
        note !== undefined ? (String(note).trim() || null) : null,
        jobOrderId,
        rowId,
      ],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('Photo update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get('photoId')

    if (!photoId) {
      return NextResponse.json({ success: false, message: 'photoId is required' }, { status: 400 })
    }

    const result = await db.query(
      `DELETE FROM inspection_photos p
       USING vehicle_inspections vi
       WHERE p.inspection_id = vi.id
         AND vi.job_order_id = $1
         AND p.id = $2
       RETURNING p.id`,
      [jobOrderId, photoId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete photo error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}