import { createClient } from '@supabase/supabase-js'

const BUCKET = 'inspection-photos'

const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
)

function extensionFor(file: File): string {
    return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
}

async function uploadFile(path: string, file: File): Promise<string> {
    const bytes = await file.arrayBuffer()

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: file.type })

    if (error) throw new Error(`Supabase upload failed: ${error.message}`)

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function uploadToBucket(
    jobOrderId: string,
    slotId: string,
    file: File,
): Promise<string> {
    const path = `job-orders/${jobOrderId}/${slotId}-${Date.now()}.${extensionFor(file)}`
    return uploadFile(path, file)
}

// Customer-submitted proof of a manual bank/e-wallet transfer (screenshot of
// the transaction) — same bucket as the inspection photos, its own folder.
export async function uploadPaymentProof(jobOrderId: string, file: File): Promise<string> {
    const path = `payments/${jobOrderId}/${Date.now()}.${extensionFor(file)}`
    return uploadFile(path, file)
}
