// warrantyController — the customer's Warranties tab (Service History) and
// filing a claim against an active warranty.

export type CustomerWarranty = {
  warrantyId: number
  description: string
  startDate: string
  expirationDate: string
  status: 'active' | 'nearing_expiration' | 'expired' | 'voided' | 'claimed'
  jobOrderId: number
  vehicle: string
  hasPendingClaim: boolean
}

export async function getCustomerWarranties(userId: number): Promise<{ active: CustomerWarranty[]; history: CustomerWarranty[] }> {
  const res = await fetch(`/api/customer/warranties?userId=${userId}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { active: [], history: [] }
  return { active: json.active, history: json.history }
}

export async function submitWarrantyClaim(
  userId: number,
  warrantyId: number,
  description: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch('/api/customer/warranties/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, warrantyId, description }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not submit the claim.' }
  return { ok: true }
}
