// warrantyClaimController — the admin's side of a warranty claim: reading
// the claim on a job order's inspection page and deciding it.

export type WarrantyClaim = {
  claimId: number
  customerDescription: string
  decision: 'pending' | 'approved' | 'disputed'
  mechanicFinding: string | null
  denyReason: string | null
  voidsWarranty: boolean | null
  decidedAt: string | null
  warrantyId: number
  coverageDescription: string
  expirationDate: string
  originalJobOrderId: number
}

export async function getWarrantyClaim(jobOrderId: string | number): Promise<WarrantyClaim | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/warranty-claim`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success || !json.claim) return null
  const c = json.claim
  return {
    claimId: c.claim_id,
    customerDescription: c.customer_description,
    decision: c.decision,
    mechanicFinding: c.mechanic_finding,
    denyReason: c.deny_reason,
    voidsWarranty: c.voids_warranty,
    decidedAt: c.decided_at,
    warrantyId: c.warranty_id,
    coverageDescription: c.coverage_description,
    expirationDate: c.expiration_date,
    originalJobOrderId: c.original_job_order_id,
  }
}

export async function decideWarrantyClaim(
  jobOrderId: string | number,
  decision:
    | { action: 'approve'; mechanicFinding: string; employeeId?: number | null }
    | { action: 'deny'; mechanicFinding: string; denyReason: string; voidsWarranty: boolean; employeeId?: number | null },
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/warranty-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(decision),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not save the decision.' }
  return { ok: true }
}
