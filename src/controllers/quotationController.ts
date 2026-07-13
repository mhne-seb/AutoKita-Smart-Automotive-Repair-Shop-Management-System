// quotationController — wraps src/data/quotations.ts (Admin job-order flow).

import { getQuotationById as findQuotationById } from '@/data/quotations'
import type { QuotationData } from '@/data/types'

// Re-exported so pages that seed useState hooks synchronously at mount still
// go through this controller instead of importing src/data/quotations.ts.
export { getQuotationById } from '@/data/quotations'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getQuotationForJobOrder(jobOrderId: string): Promise<QuotationData | null> {
  return simulateDelay(findQuotationById(jobOrderId) ?? null)
}

/** Mock "approve quotation" */
export async function approveQuotation(jobOrderId: string): Promise<{ success: boolean }> {
  return simulateDelay({ success: true })
}
