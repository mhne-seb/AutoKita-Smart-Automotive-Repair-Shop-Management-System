// inspectionController — now backed by the real database (get_inspection_data
// + get_inspection_findings) instead of src/data/inspections.ts.
//
// Known data gaps (schema has no data for these — every value below is a
// reasonable default, not something we're hiding from real data):
//   - photos: vehicle_inspections.photo is NULL for all seed rows, so photo
//     slots always start empty and technician notes always start empty —
//     there's no "notes" table in the schema at all.
//   - finding name/status: vehicle_inspections.name and .status are NULL for
//     all seed rows — only findings_description has real text. We show that
//     text as the finding's note, default the name to "Inspection Finding",
//     and default status to 'needs-attention' so it prompts a mechanic to
//     actually classify it, rather than silently marking it "OK".
//   - timer.currentDurationHours / running: derived from job_orders.started_at
//     if present, otherwise 0 / not running.

import type { InspectionData, MechanicalFinding, InspectionPhotoSlot } from '@/data/types'
import { REFERENCE_PHOTO_STATUS } from '@/data/types'

const DEFAULT_PHOTO_SLOTS: InspectionPhotoSlot[] = [
  { id: 'front', label: 'Front Quarter' },
  { id: 'engine', label: 'Engine Bay' },
  { id: 'under', label: 'Underchassis' },
]

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// job_orders.estimated_duration is a Postgres TIME value like "02:30:00" — convert to decimal hours.
function timeToHours(time: string | null): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return Math.round((h + m / 60) * 10) / 10
}

// The booking forms cram the customer's request into one free-text column in
// two different shapes:
//   /book page:        "Requested: <slot> | Service: <category> | <notes>"
//   dashboard modal:   "Category: <category>. Notes: <notes>"
// Pull the parts back out for a clean summary; anything else is shown as-is.
function parseConcern(raw: string): { category: string | null; notes: string | null; requestedSlot: string | null } {
  const bookPage = raw.match(/^Requested:\s*(.*?)\s*\|\s*Service:\s*(.*?)\s*\|\s*([\s\S]*)$/)
  if (bookPage) {
    return { requestedSlot: bookPage[1].trim() || null, category: bookPage[2].trim() || null, notes: bookPage[3].trim() || null }
  }
  const modal = raw.match(/^Category:\s*(.*?)\.\s*Notes:\s*([\s\S]*)$/)
  if (modal) {
    return { requestedSlot: null, category: modal[1].trim() || null, notes: modal[2].trim() || null }
  }
  return { requestedSlot: null, category: null, notes: null }
}

function toRequest(ticket: any): InspectionData['request'] {
  if (!ticket) return null
  const raw = String(ticket.customer_concern ?? '').trim()
  const parsed = parseConcern(raw)
  const notes = parsed.notes && !/^(none|no specific concerns)$/i.test(parsed.notes) ? parsed.notes : null
  return {
    serviceMode: ticket.service_mode === 'home_service' ? 'Home Service' : 'Shop Visit',
    homeAddress: ticket.service_mode === 'home_service' && ticket.home_service_address && ticket.home_service_address !== 'None'
      ? ticket.home_service_address
      : null,
    category: parsed.category && parsed.category !== 'Not specified' ? parsed.category : null,
    notes,
    requestedSlot: parsed.requestedSlot,
    requestedOn: formatDateTime(ticket.request_date),
    raw,
  }
}

function buildPhotoSlots(photoRows: any[]): InspectionPhotoSlot[] {
  // Start with 3 slots corresponding to the defaults
  const slots: (InspectionPhotoSlot | null)[] = [null, null, null]
  const unassignedPhotos: any[] = []

  // Pass 1: Match by exact title (case-insensitive) to default slot labels
  for (const photo of photoRows) {
    const defaultIndex = DEFAULT_PHOTO_SLOTS.findIndex(
      (d, idx) => slots[idx] === null && d.label.toLowerCase() === String(photo.title ?? '').trim().toLowerCase()
    )
    if (defaultIndex !== -1) {
      slots[defaultIndex] = {
        id: DEFAULT_PHOTO_SLOTS[defaultIndex].id,
        label: photo.title,
        title: photo.title,
        url: photo.photo_url ?? photo.photo ?? photo.url,
        rowId: photo.id,
        note: photo.note ?? '',
      }
    } else {
      unassignedPhotos.push(photo)
    }
  }

  // Pass 2: Assign unassigned photos to any remaining empty default slots
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null) {
      const nextPhoto = unassignedPhotos.shift()
      if (nextPhoto) {
        slots[i] = {
          id: DEFAULT_PHOTO_SLOTS[i].id,
          label: nextPhoto.title || DEFAULT_PHOTO_SLOTS[i].label,
          title: nextPhoto.title || DEFAULT_PHOTO_SLOTS[i].label,
          url: nextPhoto.photo_url ?? nextPhoto.photo ?? nextPhoto.url,
          rowId: nextPhoto.id,
          note: nextPhoto.note ?? '',
        }
      } else {
        slots[i] = {
          id: DEFAULT_PHOTO_SLOTS[i].id,
          label: DEFAULT_PHOTO_SLOTS[i].label,
          title: DEFAULT_PHOTO_SLOTS[i].label,
          url: undefined,
          rowId: undefined,
          note: '',
        }
      }
    }
  }

  // Pass 3: Any additional photos beyond the 3 defaults are appended as extra slots
  const extraSlots: InspectionPhotoSlot[] = unassignedPhotos.map((p, i) => ({
    id: `custom-${p.id || i}`,
    label: p.title || 'Inspection Photo',
    title: p.title || 'Inspection Photo',
    url: p.photo_url ?? p.photo ?? p.url,
    rowId: p.id,
    note: p.note ?? '',
  }))

  return [...(slots as InspectionPhotoSlot[]), ...extraSlots]
}

function toInspectionData(row: any): InspectionData {
  const photoRows: any[] = row.referencePhotos ?? []
  const photoSlots: InspectionPhotoSlot[] = buildPhotoSlots(photoRows)

  const findings: MechanicalFinding[] = (row.findings ?? [])
    .filter((f: any) => f.status !== REFERENCE_PHOTO_STATUS)
    .map((f: any) => ({
      id: String(f.id),
      name: f.name || 'Inspection Finding',
      note: f.description || f.findings_description || f.notes || '',
      status: f.status === 'needs_attention' ? 'needs-attention' : (f.status ?? 'needs-attention'),
      photo: f.photo ?? undefined,
    }))

  const laborHoursEstimate = timeToHours(row.estimated_duration)
  const currentDurationHours = row.started_at
    ? Math.round(((Date.now() - new Date(row.started_at).getTime()) / 36e5) * 10) / 10
    : 0

  return {
    jobOrderId: String(row.id),
    vehicleTitle: `${row.vin ? '' : ''}${row.vehicle_model ?? 'Unknown Vehicle'}`.trim(),
    plate: row.plate_number || '—',
    customer: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Unknown Customer',
    photoSlots,
    findings,
    timer: {
      startedAt: formatDateTime(row.started_at),
      estimatedFinish: formatDateTime(row.date_promised),
      laborHoursEstimate,
      currentDurationHours,
      running: Boolean(row.started_at) && !row.completed_at,
      progressPercent: row.status === 'inspecting' ? 25 : row.status ? 50 : 0,
    },
    approvalRequired: row.status === 'pending_customer_approval',
    diagnosticScanAuthorized: Boolean(row.diagnosticScanAuthorized),
    request: toRequest(row.ticket),
    quotationStarted: Boolean(row.quotationStarted),
  }
}

/** Fetches inspection data for a job order from the real database. */
export async function getInspectionById(jobOrderId: string): Promise<InspectionData | undefined> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/inspection`)
  if (res.status === 404) return undefined
  const json = await res.json()
  if (!json.success) return undefined
  return toInspectionData(json.data)
}

export async function getInspectionForJobOrder(jobOrderId: string): Promise<InspectionData | null> {
  return (await getInspectionById(jobOrderId)) ?? null
}

export async function uploadInspectionPhoto(
  jobOrderId: string,
  slotId: string,
  label: string,
  file: File,
  title?: string,
  rowId?: number,
): Promise<{ url: string; rowId: number; title: string } | null> { 
  const form = new FormData()
  form.append('file', file)
  form.append('slotId', slotId)
  form.append('label', label)
  form.append('title', title ?? label)
  if (rowId) form.append('rowId', String(rowId))

  const res = await fetch(`/api/job-orders/${jobOrderId}/photos`, {
    method: 'POST',
    body: form,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return null
  return { url: json.url as string, rowId: json.id as number, title: json.title as string }
}

/** Saves the mechanic's condition note for a walkaround photo. */
export async function saveWalkaroundNote(jobOrderId: string, rowId: number, note: string): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/photos`, {
    method: 'PATCH', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowId, note }),
  })
  const json = await res.json().catch(() => null)
  return Boolean(res.ok && json?.success)
}

/** Saves the title for a walkaround photo. */
export async function saveWalkaroundTitle(jobOrderId: string, rowId: number, title: string): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/photos`, {
    method: 'PATCH', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rowId, title }),
  })
  const json = await res.json().catch(() => null)
  return Boolean(res.ok && json?.success)
}

/** Deletes a walkaround photo. */
export async function deleteInspectionPhoto(jobOrderId: string, photoId: number): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/photos?photoId=${photoId}`, {
    method: 'DELETE',
  })
  if (!res.ok) return false
  const json = await res.json().catch(() => null)
  return Boolean(json?.success)
}

export async function addInspectionFinding(jobOrderId: string, finding: Partial<MechanicalFinding>): Promise<MechanicalFinding | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/findings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finding)
  })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.success) return null
  return {
    id: String(json.data.id),
    name: json.data.name,
    note: json.data.description || json.data.findings_description || '',
    status: json.data.status,
    photo: json.data.photo || undefined,
  }
}

export async function updateInspectionFinding(jobOrderId: string, finding: Partial<MechanicalFinding> & { id: string }): Promise<MechanicalFinding | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/findings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finding)
  })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.success) return null
  return {
    id: String(json.data.id),
    name: json.data.name,
    note: json.data.description || json.data.findings_description || '',
    status: json.data.status,
    photo: json.data.photo || undefined,
  }
}

export async function deleteInspectionFinding(jobOrderId: string, findingId: string): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/findings?findingId=${findingId}`, {
    method: 'DELETE'
  })
  if (!res.ok) return false
  const json = await res.json()
  return json.success
}

/**
// ---------------------------------------------------------------------------
// inspectionController — wraps src/data/inspections.ts (Admin Inspection
// Report page).
// ---------------------------------------------------------------------------

import { getInspectionById as findInspectionById } from '@/data/inspections'
import type { InspectionData } from '@/data/types'

// Re-exported so pages that need synchronous access still go through this controller instead
// of importing src/data/inspections.ts directly.
export { getInspectionById } from '@/data/inspections'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getInspectionForJobOrder(jobOrderId: string): Promise<InspectionData | null> {
  return simulateDelay(findInspectionById(jobOrderId) ?? null)
}

*/
