'use client'

// Route: /history/customers — thin wrapper that renders the shared HistoryLogs page pre-filtered to the Customers tab.
import { HistoryLogs } from '@/views/HistoryLogs'

export default function Page() {
  return <HistoryLogs tab="customers" />
}
