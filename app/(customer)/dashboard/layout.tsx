'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { DashHeader } from '@/components/dashboard/DashHeader'
import { ChatWidget } from '@/components/dashboard/ChatWidget'

// NOTE: mock/client-side only, same pattern as app/(admin)/layout.tsx.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const isCustomer = sessionStorage.getItem('autokita_customer') === 'true'
    if (!isCustomer) {
      router.replace('/login')
      return
    }
    setChecked(true)
  }, [router])

  if (!checked) return null

  return (
    <div className="min-h-screen bg-background">
      <DashHeader />
      {children}
      <ChatWidget />
    </div>
  )
}
