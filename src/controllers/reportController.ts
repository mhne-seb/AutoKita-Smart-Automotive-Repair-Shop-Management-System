// reportController — wraps chart/aggregate mock data used by the Admin
// Overview and Analytics pages (src/data/mockData.ts's revenueTrend and
// serviceMix).Separated from billingController since these are
// pre-aggregated reporting numbers, not individual transaction records.

import { revenueTrend, serviceMix, churnList, type RevenuePoint, type ServiceMixSlice } from '@/data/mockData'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getRevenueTrend(): Promise<RevenuePoint[]> {
  return simulateDelay(revenueTrend)
}

export async function getServiceMix(): Promise<ServiceMixSlice[]> {
  return simulateDelay(serviceMix)
}

export async function getChurnList() {
  return simulateDelay(churnList)
}
