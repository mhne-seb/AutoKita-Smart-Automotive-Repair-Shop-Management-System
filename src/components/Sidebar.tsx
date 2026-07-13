'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutGrid,
  ListChecks,
  Wrench,
  BarChart3,
  LineChart,
  Database,
  Users,
  History,
  ChevronDown,
  MoreVertical,
  LogOut,
  X,
} from 'lucide-react'
import { Logo } from '@/components/site/Logo'

const primaryNav = [
  { label: 'Overview', to: '/overview', icon: LayoutGrid },
  { label: 'Job Queue', to: '/job-queue', icon: ListChecks },
  { label: 'Job Orders', to: '/job-orders', icon: Wrench },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'Sales & Payroll', to: '/sales-payroll', icon: LineChart },
  { label: 'Database Administration', to: '/database', icon: Database },
  { label: 'Mechanics Management', to: '/mechanics', icon: Users },
] as const

// Each of these opens its own dedicated History Logs page (see
// pages/HistoryLogs.tsx) with its own mock data, stat cards, search/filter,
// and pagination — separate from the live/operational pages above.
const historyLogNav = [
  { label: 'Job Orders', to: '/history/job-orders' },
  { label: 'Tickets', to: '/history/tickets' },
  { label: 'Customers', to: '/history/customers' },
] as const

// ---- Component ----------------------------------------------------------

export function Sidebar() {
  const [historyOpen, setHistoryOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`)

  const handleLogout = () => {
    sessionStorage.removeItem('autokita_admin')
    router.push('/login')
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[280px] shrink-0 flex-col border-r border-border bg-background">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <Link href="/overview" className="flex items-center gap-3">
          <Logo className="h-9 w-auto" />
          <span className="text-sm font-bold uppercase tracking-wide text-brand">
            Automotive Admin
          </span>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {primaryNav.map(({ label, to, icon: Icon }) => {
            const active = isActive(to)
            return (
              <li key={to}>
                <Link
                  href={to}
                  className={[
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-brand text-brand-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon size={18} className={active ? 'text-brand-foreground' : 'text-muted-foreground group-hover:text-foreground'} />
                  <span className="flex-1">{label}</span>
                  {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-foreground" />}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* History logs (collapsible) */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          >
            <History size={14} />
            <span className="flex-1 text-left">History Logs</span>
            <ChevronDown size={14} className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>

          {historyOpen && (
            <ul className="mt-1 space-y-1 pl-9">
              {historyLogNav.map(({ label, to }) => {
                const active = isActive(to)
                return (
                  <li key={to}>
                    <Link
                      href={to}
                      className={[
                        'block rounded-md px-3 py-2 text-sm transition-colors',
                        active ? 'font-semibold text-brand' : 'text-muted-foreground hover:text-foreground',
                      ].join(' ')}
                    >
                      {label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </nav>

      {/* User footer */}
      <div className="relative border-t border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
            B
          </div>
          <div className="flex-1 leading-tight">
            <p className="text-sm font-semibold text-foreground">Boss Boyet</p>
            <p className="text-xs text-muted-foreground">Admin - AutoKita</p>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Account options"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        {menuOpen && (
          <div className="absolute bottom-16 right-4 w-40 rounded-lg border border-border bg-card p-1 shadow-lg">
            <button
              onClick={() => {
                setMenuOpen(false)
                setLogoutConfirmOpen(true)
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        )}
      </div>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <LogOut size={20} />
              </div>
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <h3 className="mt-4 text-lg font-bold text-foreground">Log out?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Are you sure you want to log out of your account?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}