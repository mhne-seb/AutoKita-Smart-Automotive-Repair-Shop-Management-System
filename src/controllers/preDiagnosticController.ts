
import type { Stage } from '@/data/types'

export interface PreDiagnosticRound {
  id: number
  mechanicNotes: string
  status: 'pending' | 'approved' | 'disputed'
  createdAt: string
  approvedAt: string | null
  // Only present when status is 'disputed' — what the customer said was wrong.
  customerReason: string | null
  respondedAt: string | null
}

function toPreDiagnosticRound(row: any): PreDiagnosticRound {
  return {
    id: row.id,
    mechanicNotes: row.mechanic_notes ?? '',
    status: row.customer_approval_status,
    createdAt: row.datetime_created,
    approvedAt: row.datetime_approved,
    customerReason: row.customer_reason ?? null,
    respondedAt: row.responded_at ?? null,
  }
}

/** Fetches the most recent send-for-approval round for a job order, or null if none exists yet. */
export async function getLatestPreDiagnostic(jobOrderId: string): Promise<PreDiagnosticRound | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/pre-diagnostic`)
  const json = await res.json()
  if (!json.success || !json.data) return null
  return toPreDiagnosticRound(json.data)
}

/** Sends a new round for approval (e.g. inspection findings, or a finished quotation). */
export async function sendForApproval(
  jobOrderId: string,
  notes: string,
  context: 'inspection' | 'quotation' = 'inspection',
): Promise<PreDiagnosticRound | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/pre-diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes, context }),
  })
  const json = await res.json()
  if (!json.success) return null
  return toPreDiagnosticRound(json.data)
}

/** Recalls a pending approval so the admin can make further changes before re-sending. */
export async function recallApproval(jobOrderId: string): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/pre-diagnostic`, {
    method: 'DELETE',
  })
  const json = await res.json()
  return json.success === true
}



export interface ScanAuthorization {
  id: number
  adminNote: string | null
  decision: 'pending' | 'approved' | 'disputed' // disputed = declined
  requestedAt: string
  decidedAt: string | null
}

/** Asks the customer to approve using the scanner. Refused if one is already pending. */
export async function requestScanAuthorization(
  jobOrderId: string,
  note: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/scan-authorization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not send the request.' }
  return { ok: true }
}
