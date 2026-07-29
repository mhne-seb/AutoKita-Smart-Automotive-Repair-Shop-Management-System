// reportController — wraps chart/aggregate mock data used by the Admin
// Overview and Analytics pages (src/data/mockData.ts's revenueTrend and
// serviceMix).Separated from billingController since these are
// pre-aggregated reporting numbers, not individual transaction records.

import { revenueTrend, serviceMix, churnList, type RevenuePoint, type ServiceMixSlice } from '@/data/mockData'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getAnalytics(days?: number) {
  try {
    const query = days ? `?days=${days === Infinity ? 3650 : days}` : ''
    const res = await fetch(`/api/analytics${query}`)
    const json = await res.json()
    if (json.success) return json.data
    console.error('Failed to load analytics:', json.error)
    return null
  } catch (error) {
    console.error('Network error fetching analytics:', error)
    return null
  }
}

export async function getRevenueTrend(): Promise<RevenuePoint[]> {
  return simulateDelay(revenueTrend)
}

export async function getServiceMix(): Promise<ServiceMixSlice[]> {
  return simulateDelay(serviceMix)
}

export async function getChurnList() {
  try {
    const res = await fetch('/api/predict/churn')
    const json = await res.json()
    if (json.success) return json.data
    console.error('Failed to load churn predictions:', json.error)
    return []
  } catch (error) {
    console.error('Network error fetching churn predictions:', error)
    return []
  }
}
