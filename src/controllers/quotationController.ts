// quotationController — now backed by the real database (get_job_order_services
// + get_job_order_parts) instead of src/data/quotations.ts.
//
// Known schema gap: job_order_parts only links to job_order_id, not to a
// specific service — so parts and services are two separate flat lists in
// the database, unlike the mock data where each service owns its own parts.
// We keep every real service as its own card, and add all real parts as one
// extra "Parts & Materials" card, rather than forcing a fake link that
// doesn't exist in the schema.

import type { QuotationData, QuotationService, QuotationPart } from '@/data/types'

function toQuotationData(row: any): QuotationData {
  // Group parts by their service
  const partsByService = row.parts.reduce((acc: any, part: any) => {
    const serviceId = part.job_order_service_id
    if (!acc[serviceId]) acc[serviceId] = []
    acc[serviceId].push({
      id: `PRT-${part.id}`,
      name: part.description || 'Unnamed Part',
      partNo: part.part_number || '—',
      qty: part.quantity ?? 1,
      unitPrice: Number(part.retail_unit_price ?? 0),
      status: part.status === 'in_stock' ? 'in-stock' : 'to-order',
    })
    return acc
  }, {})

  const services: QuotationService[] = row.services.map((s: any) => ({
    id: `SVC-${s.id}`,
    code: `SVC-${String(s.id).padStart(3, '0')}`,
    name: s.service_name || 'Unnamed Service',
    description: s.description_of_work || '',
    laborHours: s.estimated_hours ?? 0,
    laborCost: Number(s.actual_amount ?? s.amount ?? 0),
    parts: partsByService[s.id] || [],
    dbServiceId: s.service_id,
    estimated_amount: s.estimated_amount !== null ? Number(s.estimated_amount) : undefined,
    estimated_hours: s.estimated_hours !== null ? Number(s.estimated_hours) : undefined,
  }))

  return {
    jobOrderId: String(row.id),
    services,
    notes: row.quotation_notes || '',
    sentToCustomer: Boolean(row.sent_to_customer),
  }
}

/** Fetches quotation data for a job order from the real database. */
export async function getQuotationById(jobOrderId: string): Promise<QuotationData | undefined> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/quotation`)
  if (res.status === 404) return undefined
  const json = await res.json()
  if (!json.success) return undefined
  return toQuotationData(json.data)
}

export async function getQuotationForJobOrder(jobOrderId: string): Promise<QuotationData | null> {
  return (await getQuotationById(jobOrderId)) ?? null
}

/** Mock "approve quotation" — no real write endpoint for this yet. */
export async function approveQuotation(jobOrderId: string): Promise<{ success: boolean }> {
  return { success: true }
}

export async function getQuotationData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/quotation?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      quotation_approved: boolean
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    quotationStatus: 'preparing' | 'ready'
    services: {
      id: number;
      service_name: string;
      description_of_work: string;
      estimated_hours: number;
      actual_amount: string;
      estimated_amount: string | null;
      parts: any[];
    }[]
    paymentStatus: { id: number; payment_method: string; amount_paid: string; verification_status: string; payment_date: string } | null
  }>
}

export async function confirmQuotationVia2FA(jobOrderId: number, acceptedServiceIds: number[]) {
  const res = await fetch('/api/tracking/quotation/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobOrderId, acceptedServiceIds }),
  })
  return res.json() as Promise<{ success: boolean }>
}

export async function submitQuotationPayment(jobOrderId: number, method: 'shop' | 'ewallet', amount: number, acceptedServiceIds: number[]) {
  const res = await fetch('/api/tracking/quotation/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobOrderId, method, amount, acceptedServiceIds }),
  })
  return res.json() as Promise<{ success: boolean; paymentId: number }>
}

export async function getQuotationPaymentStatus(jobOrderId: number) {
  const res = await fetch(`/api/tracking/quotation/payment-status?jobOrderId=${jobOrderId}`)
  return res.json() as Promise<{
    paymentStatus: { verification_status: string; payment_method: string } | null
  }>
}