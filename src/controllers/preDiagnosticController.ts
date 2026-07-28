// preDiagnosticController — real database-backed "send for approval" /
// "customer decision" flow, built on pre_diagnostics + your teammate's
// update_pre_diagnostic_approval() function.
//
// The real Customer-portal approval page is someone else's task — these
// functions exist so the Admin-side buttons ("Upload to customer portal",
// "Send to Customer") actually persist real data, and so we can simulate
// what the customer's decision would do.

import type { Stage } from '@/data/types'

export interface PreDiagnosticRound {
  id: number
  mechanicNotes: string
  status: 'pending' | 'approved' | 'disputed'
  createdAt: string
  approvedAt: string | null
}

function toPreDiagnosticRound(row: any): PreDiagnosticRound {
  return {
    id: row.id,
    mechanicNotes: row.mechanic_notes ?? '',
    status: row.customer_approval_status,
    createdAt: row.datetime_created,
    approvedAt: row.datetime_approved,
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
export async function sendForApproval(jobOrderId: string, notes: string): Promise<PreDiagnosticRound | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/pre-diagnostic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  const json = await res.json()
  if (!json.success) return null
  return toPreDiagnosticRound(json.data)
}

/**
 * Simulates the customer's decision on the latest round. Pass advanceToStage
 * when approval should also move the job order's real stage forward (e.g.
 * approving the final quotation moves it to 'in-progress').
 */
export async function simulateCustomerResponse(
  jobOrderId: string,
  status: 'approved' | 'disputed',
  advanceToStage?: Stage
): Promise<PreDiagnosticRound | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/pre-diagnostic/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, advanceToStage }),
  })
  const json = await res.json()
  if (!json.success) return null
  return toPreDiagnosticRound(json.data)
}