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

function toInspectionData(row: any): InspectionData {
  const findings: MechanicalFinding[] = row.findings.map((f: any) => ({
    id: String(f.id),
    name: f.name || 'Inspection Finding',
    note: f.findings_description || f.notes || '',
    status: f.status ?? 'needs-attention',
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
    photoSlots: DEFAULT_PHOTO_SLOTS,
    notes: [], // no notes table exists yet — technician notes are session-only until one is added
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
