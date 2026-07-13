'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/layouts/AdminLayout'

// NOTE: this is a client-side mock guard only (sessionStorage), since there is
// no real backend/auth yet
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const isAdmin = sessionStorage.getItem('autokita_admin') === 'true'
    if (!isAdmin) {
      router.replace('/login')
      return
    }
    setChecked(true)
  }, [router])

  if (!checked) return null

  return <AdminLayout>{children}</AdminLayout>
}
