'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { MechanicAIAssistant } from '@/components/dashboard/MechanicAIAssistant'

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

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <MechanicAIAssistant />
    </div>
  )
}
