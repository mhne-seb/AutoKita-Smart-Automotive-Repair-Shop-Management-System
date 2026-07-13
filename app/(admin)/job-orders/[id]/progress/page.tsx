'use client'

// Route: /job-orders/[id]/progress — reads the dynamic [id] segment via useParams and renders the Admin Service Progress checklist for that job order.
import { useParams } from 'next/navigation'
import { ServiceProgress } from '@/pages/ServiceProgress'

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <ServiceProgress jobOrderId={id} />
}
