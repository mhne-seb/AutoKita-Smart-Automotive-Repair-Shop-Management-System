// customerController
//
// Wraps src/data/mockData.ts's `customers` list behind an async interface,
// same pattern as jobOrderController. Used by Admin pages (Overview,
// Analytics, History) that need customer records.

import { customers, type Customer } from '@/data/mockData'
import type { JobStatus } from '@/data/mockData'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getCustomers(): Promise<Customer[]> {
  return simulateDelay(customers)
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  return simulateDelay(customers.find((c) => c.customerId === customerId) ?? null)
}

/**
 * Updates a customer record's status (used by the Admin Overview page's row
 * actions — "Mark Complete" / "Cancel Order")
 */
export async function updateCustomerStatus(customerId: string, status: JobStatus): Promise<Customer | null> {
  const customer = customers.find((c) => c.customerId === customerId)
  if (!customer) return simulateDelay(null)
  customer.status = status
  return simulateDelay(customer)
}
