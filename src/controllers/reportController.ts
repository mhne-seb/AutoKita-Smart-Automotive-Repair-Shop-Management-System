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
  try {
    const res = await fetch('/api/analytics')
    const json = await res.json()

    if (json.success && json.data?.chartData) {
      return json.data.chartData.map((row: any) => ({
        month: row.month,
        revenue: Number(row.revenue) || 0,
      }))
    }

    return revenueTrend // Fallback to mock data if table is empty
  } catch (error) {
    console.error('Network error fetching revenue trend:', error)
    return revenueTrend
  }
}

export async function getServiceMix(): Promise<ServiceMixSlice[]> {
  try {
    const res = await fetch('/api/analytics')
    const json = await res.json()

    if (json.success && json.data?.serviceMix && json.data.serviceMix.length > 0) {
      return json.data.serviceMix
    }

    return serviceMix
  } catch (error) {
    console.error('Network error fetching service mix:', error)
    return serviceMix
  }
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
