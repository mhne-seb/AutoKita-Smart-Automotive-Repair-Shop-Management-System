import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadAvatar, removeFile, signFileUrl } from '@/lib/storage'
import { logCustomerAccountChange } from '@/lib/audit'

// The profile page shrinks photos to ~20 KB before sending; this limit only
// stops someone calling the route directly with a huge file.
const MAX_BYTES = 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] // the bucket's allowed types

// Sets or replaces the customer's profile photo.
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const userId = parseInt(String(form.get('userId') ?? ''), 10)
    const file = form.get('file')
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'userId must be a number' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'No photo uploaded' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Photo must be a JPEG, PNG or WebP image' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: 'Photo must be under 1MB' }, { status: 413 })
    }

    const { rows } = await db.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId])
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const stored = await uploadAvatar(userId, file)
    await db.query(`UPDATE users SET avatar_url = $2 WHERE id = $1`, [userId, stored])
    await removeFile(rows[0].avatar_url) // the old photo, now unused
    await logCustomerAccountChange(
      userId,
      { profile_photo: rows[0].avatar_url ? 'old photo' : 'none' },
      { profile_photo: 'new photo uploaded' },
    )

    return NextResponse.json({ success: true, avatarUrl: await signFileUrl(stored) })
  } catch (err) {
    console.error('Profile photo upload error:', err)
    return NextResponse.json(
      { success: false, message: 'Upload failed', debug: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

// Removes the photo; the page goes back to the plain icon.
export async function DELETE(request: NextRequest) {
  try {
    const userId = parseInt(request.nextUrl.searchParams.get('userId') || '', 10)
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, message: 'userId must be a number' }, { status: 400 })
    }
    const { rows } = await db.query(`SELECT avatar_url FROM users WHERE id = $1`, [userId])
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }
    await db.query(`UPDATE users SET avatar_url = NULL WHERE id = $1`, [userId])
    await removeFile(rows[0].avatar_url)
    if (rows[0].avatar_url) {
      await logCustomerAccountChange(userId, { profile_photo: 'had a photo' }, { profile_photo: 'removed' })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Profile photo remove error:', err)
    return NextResponse.json(
      { success: false, message: 'Could not remove the photo', debug: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
