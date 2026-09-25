// ---------------------------------------------------------------------------
// billingController — wraps src/data/billings.ts (Customer Billing & Warranty
// page) and src/data/mockData.ts's paymentRecords (Admin Sales & Payroll).
// ---------------------------------------------------------------------------

import { INITIAL_SERVICES, WARRANTIES, WARRANTY_HISTORY, REWARDS, type Service, type Warranty, type Rewards } from '@/data/billings'
import { paymentRecords, weeklyServices, type PaymentRecord, type WeeklyService } from '@/data/mockData'
import { SERVICE_HISTORY, SHOP_INFO, type ServiceRecord } from '@/data/history'
import { parseStamp } from '@/lib/utils'
import { SHOP_PROFILE } from '@/data/shopProfile'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getServices(): Promise<Service[]> {
  return simulateDelay(INITIAL_SERVICES)
}

export async function getWarranties(): Promise<Warranty[]> {
  return simulateDelay(WARRANTIES)
}

export async function getWarrantyHistory(): Promise<Warranty[]> {
  return simulateDelay(WARRANTY_HISTORY)
}

export async function getRewards(): Promise<Rewards> {
  return simulateDelay(REWARDS)
}

export async function getPaymentRecords(): Promise<PaymentRecord[]> {
  return simulateDelay(paymentRecords)
}

export async function getWeeklyServices(): Promise<WeeklyService[]> {
  return simulateDelay(weeklyServices)
}

/** The Customer's completed/cancelled service history — feeds the History tab and its PDF invoice export. */
export async function getServiceHistory(userId: number): Promise<ServiceRecord[]> {
  const res = await fetch(`/api/customer/history?userId=${userId}`)
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return []

  type ApiRecord = {
    id: string
    closedAt: string | null
    vehicle: string
    desc: string
    total: number
    status: 'Completed' | 'Cancelled'
    mechanics: string[]
    items: { label: string; amount: number }[]
  }

  const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (json.records as ApiRecord[]).map((r) => {
    const d = parseStamp(r.closedAt)
    return {
      id: r.id,
      date: d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      // Local date, not toISOString() — in Manila that would read as the day
      // before for anything in the first 8 hours, breaking the date filter.
      isoDate: d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '',
      vehicle: r.vehicle,
      desc: r.desc,
      amt: peso(r.total),
      status: r.status,
      mechanic: r.mechanics.length > 0 ? r.mechanics.join(', ') : 'Not recorded',
      location: SHOP_PROFILE.name,
      // No warranty terms are stored per job order yet, so don't invent one.
      warranty: 'See your job order',
      items: r.items.map((i) => [i.label, peso(i.amount)] as [string, string]),
    }
  })
}

/** Shop details (name/address/contact) shown on generated PDF invoices — live from Supabase shops table. */
export async function getShopInfo() {
  try {
    const res = await fetch('/api/shop')
    const json = await res.json()
    if (json.success && json.shop) {
      return {
        name: json.shop.name || SHOP_INFO.name,
        tagline: SHOP_INFO.tagline,
        address: json.shop.address || SHOP_INFO.address,
        phone: json.shop.contact_number || SHOP_INFO.phone,
        email: json.shop.email || SHOP_INFO.email,
        tin: SHOP_INFO.tin,
      }
    }
  } catch (err) {
    console.warn('Failed to fetch live shop info, using default:', err)
  }
  return simulateDelay(SHOP_INFO)
}
