import { NextResponse } from 'next/server'
import { uploadFindingPhoto, signFileUrl } from '@/lib/storage'

// Uploads the photo for a finding before the finding itself is saved — the
// modal uploads on pick and sends back the URL with the rest of the form.
const MAX_BYTES = 5 * 1024 * 1024 // matches the bucket's own 5MB limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] // and its allowed types

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'No photo uploaded' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'Photo must be a JPEG, PNG or WebP image' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: 'Photo must be under 5MB' }, { status: 413 })
    }
    // The modal previews this and sends it back with the finding;
    // service-findings turns it back into the permanent link before saving.
    const url = await signFileUrl(await uploadFindingPhoto(id, file))
    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('Finding photo upload error:', error)
    return NextResponse.json(
      { success: false, message: 'Upload failed', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
