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
    
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data.success || data.session?.role !== 'customer') {
          sessionStorage.removeItem('autokita_admin')
          sessionStorage.removeItem('autokita_customer')
          sessionStorage.removeItem('autokita_user_id')
          sessionStorage.removeItem('autokita_user_name')
          sessionStorage.removeItem('autokita_user_title')
          router.replace('/login')
        } else {
          setChecked(true)
        }
      })
      .catch(() => {
        sessionStorage.removeItem('autokita_admin')
        sessionStorage.removeItem('autokita_customer')
        sessionStorage.removeItem('autokita_user_id')
        sessionStorage.removeItem('autokita_user_name')
        sessionStorage.removeItem('autokita_user_title')
        router.replace('/login')
      })
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
