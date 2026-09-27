import { createClient } from '@supabase/supabase-js'

const BUCKET = 'job-orders'

const supabase = createClient(
    process.env.SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false } },
)

// The bucket is private: a stored link is only an address. Anything shown to
// a browser goes through signFileUrl(s), which hands out a pass that expires.
const PASS_SECONDS = 60 * 60
const LINK_MARKERS = [`/object/public/${BUCKET}/`, `/object/sign/${BUCKET}/`]

// A photo reference can be the permanent link saved in the database, a
// temporary link the browser sent back, or a bare path — reduce any of them
// to the file's path inside the bucket. Links to anywhere else give null.
function pathOf(ref: string): string | null {
    for (const marker of LINK_MARKERS) {
        const i = ref.indexOf(marker)
        if (i !== -1) return decodeURIComponent(ref.slice(i + marker.length).split('?')[0])
    }
    return /^https?:\/\//.test(ref) ? null : ref
}

// What gets saved: always the permanent form, never a temporary link (that
// would stop working an hour after it was saved).
export function toStoredRef(ref: string | null | undefined): string | null {
    if (!ref) return null
    const path = pathOf(ref)
    return path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : ref
}

// What gets shown: a link that works for PASS_SECONDS. Links that aren't in
// this bucket (e.g. placeholder images in seed data) pass through unchanged.
export async function signFileUrl(ref: string | null | undefined): Promise<string | null> {
    return (await signFileUrls([ref]))[0]
}

// Same, for a list — one request to Supabase instead of one per photo.
export async function signFileUrls(refs: (string | null | undefined)[]): Promise<(string | null)[]> {
    const paths = refs.map((ref) => (ref ? pathOf(ref) : null))
    const wanted = [...new Set(paths.filter((p): p is string => p !== null))]
    if (wanted.length === 0) return refs.map((ref) => ref ?? null)

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, PASS_SECONDS)
    if (error) console.error('Signing photo links failed:', error.message)
    const byPath = new Map((data ?? []).filter((d) => d.path && !d.error).map((d) => [d.path as string, d.signedUrl]))
    return refs.map((ref, i) => {
        const path = paths[i]
        return path ? byPath.get(path) ?? null : ref ?? null
    })
}

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
