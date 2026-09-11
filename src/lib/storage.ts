import { createClient } from '@supabase/supabase-js'

const BUCKET = 'inspection-photos'

const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
)

export async function uploadToBucket(
    jobOrderId: string, 
    slotId: string,
    file: File,
): Promise<string> {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `job-orders/${jobOrderId}/${slotId}-${Date.now()}.${ext}`

    const bytes = await file.arrayBuffer()
    
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type})
    
    if (error) throw new Error(`Supabase upload failed: ${error.message}`)

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}