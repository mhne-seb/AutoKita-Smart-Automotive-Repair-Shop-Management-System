'use client'

// Route: /job-orders/[id]/inspection — reads the dynamic [id] segment via useParams and renders the Admin Inspection Report for that job order.
import { useParams } from 'next/navigation'
import { InspectionReport } from '@/pages/InspectionReport'

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <InspectionReport jobOrderId={id} />
}
