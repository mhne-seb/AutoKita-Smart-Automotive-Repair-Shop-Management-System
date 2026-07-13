// historyController — the Admin History Logs page does heavy synchronous
// filtering/derivation (useMemo) directly off these arrays

export {
  jobOrderHistory,
  jobOrderHistorySummary,
  ticketHistory,
  ticketHistorySummary,
  customerHistory,
  customerHistorySummary,
  currency,
  type HistoryStatus,
  type CustomerTier,
} from '@/data/historylogs'

import {
  jobOrderHistory as _jobOrderHistory,
  ticketHistory as _ticketHistory,
  customerHistory as _customerHistory,
} from '@/data/historylogs'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getJobOrderHistory() {
  return simulateDelay(_jobOrderHistory)
}
export async function getTicketHistory() {
  return simulateDelay(_ticketHistory)
}
export async function getCustomerHistory() {
  return simulateDelay(_customerHistory)
}
