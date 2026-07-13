// mechanicController — wraps src/data/mockData.ts's `mechanics` list.
// Used by the Admin Mechanics Management page and job-order assignment UI.

import { mechanics, type Mechanic } from '@/data/mockData'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getMechanics(): Promise<Mechanic[]> {
  return simulateDelay(mechanics)
}
