// ---------------------------------------------------------------------------
// billingController — wraps src/data/billings.ts (Customer Billing & Warranty
// page) and src/data/mockData.ts's paymentRecords (Admin Sales & Payroll).
// ---------------------------------------------------------------------------

import { INITIAL_SERVICES, WARRANTIES, WARRANTY_HISTORY, REWARDS, type Service, type Warranty, type Rewards } from '@/data/billings'
import { paymentRecords, weeklyServices, type PaymentRecord, type WeeklyService } from '@/data/mockData'
import { SERVICE_HISTORY, SHOP_INFO, type ServiceRecord } from '@/data/history'

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
export async function getServiceHistory(): Promise<ServiceRecord[]> {
  return simulateDelay(SERVICE_HISTORY)
}

/** Shop details (name/address/contact) shown on generated PDF invoices. */
export async function getShopInfo() {
  return simulateDelay(SHOP_INFO)
}
