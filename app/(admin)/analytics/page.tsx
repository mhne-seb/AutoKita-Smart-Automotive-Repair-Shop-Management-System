'use client'

// Route: /analytics — thin wrapper that renders the Admin Analytics page (churn tracking, revenue charts, Excel export).
import { Analytics } from '@/views/Analytics'

export default function Page() {
  return <Analytics />
}
