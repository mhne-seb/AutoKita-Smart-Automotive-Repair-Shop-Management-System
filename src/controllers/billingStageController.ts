// billingStageController.ts — browser-side calls for the admin Billing stage.
// Verifying a payment reuses verifyJobOrderPayment() from quotationController
// (same endpoint the downpayment used).

export interface BillingPayment {
  id: number
  payment_method: string
  payment_channel: string | null
  reference_number: string | null
  proof_of_payment_image: string | null
  amount_paid: number
  payment_date: string
  verification_status: 'pending' | 'verified' | 'rejected' | 'refunded'
}

export interface BillingData {
  status: string
  completedAt: string | null
  releasedAt: string | null
  customer: { name: string; phone: string }
  bill: { total: number; paid: number; balance: number }
  payments: BillingPayment[]
  services: { name: string; amount: number; addedMidService: boolean }[]
  parts: { id: number; name: string; partNo: string | null; qty: number; unitPrice: number; amount: number; warranty: boolean }[]
}

type Result = { ok: boolean; message?: string }

export async function getBillingData(jobOrderId: string): Promise<BillingData | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/billing`, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return null
  return json as BillingData
}

async function post(jobOrderId: string, body: Record<string, unknown>): Promise<Result> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/billing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Something went wrong.' }
  return { ok: true }
}

/** Customer paid cash at the counter — recorded as verified straight away. */
export function recordCashPayment(jobOrderId: string, amount: number): Promise<Result> {
  return post(jobOrderId, { action: 'record_cash', amount })
}

/** Hand the vehicle back. Server refuses unless the balance is ₱0.
 *  warrantyByPart maps job_order_parts.id -> warranty months, set once and
 *  never editable afterward. */
export function releaseVehicle(jobOrderId: string, warrantyByPart: Record<number, number> = {}): Promise<Result> {
  return post(jobOrderId, { action: 'release', warrantyByPart })
}
