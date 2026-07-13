// serviceProgressController — wraps src/data/serviceProgress.ts (Admin
// Service Progress page).


import { getServiceProgressById as findServiceProgressById } from '@/data/serviceProgress'
import type { ServiceProgressData } from '@/data/types'
export { getServiceProgressById } from '@/data/serviceProgress'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getServiceProgressForJobOrder(jobOrderId: string): Promise<ServiceProgressData | null> {
  return simulateDelay(findServiceProgressById(jobOrderId) ?? null)
}
