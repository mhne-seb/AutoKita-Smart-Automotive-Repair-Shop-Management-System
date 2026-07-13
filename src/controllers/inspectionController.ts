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
