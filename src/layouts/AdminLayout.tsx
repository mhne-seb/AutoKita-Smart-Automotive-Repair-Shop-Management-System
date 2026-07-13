import type { ReactNode } from 'react'
import { Sidebar } from '../components/Sidebar'
import { MechanicAIAssistant } from '../components/dashboard/MechanicAIAssistant'

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <MechanicAIAssistant />
    </div>
  )
}

/*
Usage with Next.js App Router (pathless route group layout):

// app/(admin)/layout.tsx
import { AdminLayout } from '@/layouts/AdminLayout'
export default function Layout({ children }) {
  return <AdminLayout>{children}</AdminLayout>
}

Every page inside app/(admin)/* is automatically wrapped by this layout and
rendered in place of {children}, without adding "/admin" to the URL.
*/