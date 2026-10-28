'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BookingPage } from '@/components/dashboard/BookingPage'

function BookPageContent() {
  const searchParams = useSearchParams()
  const rawVehicle = searchParams.get('vehicle')
  const initialVehicleId = rawVehicle && /^\d+$/.test(rawVehicle) ? rawVehicle : undefined

  useEffect(() => {
    document.title = 'Book a service — AutoKita'
  }, [])

  return <BookingPage initialVehicleId={initialVehicleId} />
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
      <BookPageContent />
    </Suspense>
  )
}
