'use client'

// Route: /history/job-orders — thin wrapper that renders the shared HistoryLogs page pre-filtered to the Job Orders tab.
import { HistoryLogs } from '@/views/HistoryLogs'

export default function Page() {
  return <HistoryLogs tab="job-orders" />
}
