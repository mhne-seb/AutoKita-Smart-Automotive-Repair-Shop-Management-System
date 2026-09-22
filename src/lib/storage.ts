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

// Photo of something the mechanic found mid-service (torn boot, worn pads)
// that goes to the customer with the approval request. Same bucket, own folder.
export async function uploadFindingPhoto(jobOrderId: string, file: File): Promise<string> {
    const path = `job-orders/${jobOrderId}/findings/${Date.now()}.${extensionFor(file)}`
    return uploadFile(path, file)
}

// Photo from the road test (dashboard, odometer, the fault if it failed).
export async function uploadRoadTestPhoto(jobOrderId: string, roadTestId: number, file: File): Promise<string> {
    const path = `job-orders/${jobOrderId}/road-tests/${roadTestId}-${Date.now()}.${extensionFor(file)}`
    return uploadFile(path, file)
}

// Proof a service was actually done — one photo per finished task (shop
// policy: no task is marked Finished without it). Same bucket, own folder.
export async function uploadTaskPhoto(jobOrderId: string, taskId: string, file: File): Promise<string> {
    const path = `job-orders/${jobOrderId}/tasks/${taskId}-${Date.now()}.${extensionFor(file)}`
    return uploadFile(path, file)
}
