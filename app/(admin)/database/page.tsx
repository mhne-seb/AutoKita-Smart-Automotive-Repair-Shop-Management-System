'use client'

// Route: /database — thin wrapper that renders the Admin Database Administration page (mock audit log viewer).
import { DatabaseAdministration } from '@/views/DatabaseAdministration'

export default function Page() {
  return <DatabaseAdministration />
}
