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
  const services: QuotationService[] = row.services.map((s: any) => ({
    id: `SVC-${s.id}`,
    code: `SVC-${String(s.id).padStart(3, '0')}`,
    name: s.service_name || 'Unnamed Service',
    description: s.description_of_work || '',
    laborHours: s.estimated_hours ?? 0,
    laborCost: Number(s.amount ?? 0),
    parts: [],
  }))

  const parts: QuotationPart[] = row.parts.map((p: any) => ({
    id: `PRT-${p.id}`,
    name: p.description || 'Unnamed Part',
    partNo: p.part_number || '—',
    qty: p.quantity ?? 1,
    unitPrice: Number(p.retail_unit_price ?? 0),
    status: p.status === 'in_stock' ? 'in-stock' : 'to-order',
  }))

  // All real parts get bundled into one extra card, since the database
  // doesn't link individual parts to individual services.
  if (parts.length > 0) {
    services.push({
      id: 'PARTS',
      code: 'PARTS',
      name: 'Parts & Materials',
      description: 'All parts logged for this job order (not linked to a specific service in the current schema).',
      laborHours: 0,
      laborCost: 0,
      parts,
    })
  }

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