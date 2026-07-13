'use client'

// Route: /history/tickets — thin wrapper that renders the shared HistoryLogs page pre-filtered to the Tickets tab.
import { HistoryLogs } from '@/pages/HistoryLogs'

export default function Page() {
  return <HistoryLogs tab="tickets" />
}
