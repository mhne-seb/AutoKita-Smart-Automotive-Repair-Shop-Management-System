import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadToBucket } from '@/lib/storage'

// Stores a walkaround photo: image goes to Supabase Storage, the URL goes to
// vehicle_inspections. Slot id lives in findings_description, slot label in
// name, and status = 'reference-photo' marks the row so the findings list
// ignores it.

const MAX_BYTES = 5 * 1024 * 1024 // matches the bucket's own 5MB limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const REFERENCE_PHOTO_STATUS = 'reference-photo'

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
    if (!slotId) {
      return NextResponse.json({ success: false, message: 'Photo slot is required' }, { status: 400 })
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

    const publicUrl = await uploadToBucket(jobOrderId, slotId, file)

    const existing = await db.query(
      `SELECT id FROM vehicle_inspections
       WHERE job_order_id = $1 AND status = $2 AND findings_description = $3
       LIMIT 1`,
      [jobOrderId, REFERENCE_PHOTO_STATUS, slotId],
    )

    let rowId: number
    if (existing.rows.length > 0) {
      rowId = existing.rows[0].id
      await db.query(
        `UPDATE vehicle_inspections SET photo = $1, name = $2, logged_date = NOW() WHERE id = $3`,
        [publicUrl, label, rowId],
      )
    } else {
      const inserted = await db.query(
        `INSERT INTO vehicle_inspections (job_order_id, name, findings_description, status, photo, logged_date)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [jobOrderId, label, slotId, REFERENCE_PHOTO_STATUS, publicUrl],
      )
      rowId = inserted.rows[0].id
    }

    // The client needs the row id to save a condition note against this photo.
    return NextResponse.json({ success: true, url: publicUrl, id: rowId })
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
    const { rowId, note } = await request.json()

    if (!rowId) {
      return NextResponse.json({ success: false, message: 'rowId is required' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE vehicle_inspections SET notes = $1
       WHERE id = $2 AND job_order_id = $3 AND status = $4
       RETURNING id`,
      [String(note ?? '').trim() || null, rowId, jobOrderId, REFERENCE_PHOTO_STATUS],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Photo not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Photo note update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}