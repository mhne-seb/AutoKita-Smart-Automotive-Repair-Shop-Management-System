'use client'

// Route: /job-orders/[id] — thin wrapper that renders the Admin Job Order Detail (work order builder) page.
import { JobOrderDetail } from '@/views/JobOrderDetail'

export default function Page() {
  return <JobOrderDetail />
}
