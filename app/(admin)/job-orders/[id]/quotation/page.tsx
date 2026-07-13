'use client'

// Route: /job-orders/[id]/quotation — reads the dynamic [id] segment via useParams and renders the Admin Quotation builder for that job order.
import { useParams } from 'next/navigation'
import { Quotation } from '@/pages/Quotation'

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <Quotation jobOrderId={id} />
}
