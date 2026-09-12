'use client'

// Admin "Job Orders" board — lists every job order across all stages (inspecting/quotation/in-progress/completed), searchable and filterable by stage tab.
import { useEffect, useMemo, useState } from 'react'
import Link from "next/link";
import { ClipboardList, Search, FileText, Wrench, CheckCircle2, Eye, ChevronLeft, ChevronRight, Car, Hash, Calendar, UserCog } from 'lucide-react'
import { TopBar } from '@/components/TopBar'
import { getJobOrders } from '@/controllers/jobOrderController'
import { JobOrderCard, Stage, stageOrder, stageLabels } from '@/data/types'

type TabKey = 'all' | Stage

const stageIcons: Record<Stage, typeof Search> = {
  inspecting: Search,
  quotation: FileText,
  'in-progress': Wrench,
  completed: CheckCircle2,
}

const PAGE_SIZE = 12

// Maps each job-order stage to the page that handles it. "completed" has no
// separate page of its own — a finished job order is just the Service
// Progress page with every task checked off (see ServiceProgress.tsx).
const stageToRoute: Record<Stage, string> = {
  inspecting: 'inspection',
  quotation: 'quotation',
  'in-progress': 'progress',
  completed: 'progress',
}

export default function page() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')

  const [jobOrders, setJobOrders] = useState<JobOrderCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Local pagination state
  const [page, setPage] = useState(1)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getJobOrders(1, 1000000)
      .then((result) => {
        if (!active) return
        setJobOrders(result.data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, activeTab])

  const tabs: { key: TabKey; label: string; icon: typeof ClipboardList; count: number }[] = [
    { key: 'all', label: 'All Orders', icon: ClipboardList, count: jobOrders.length },
    ...stageOrder.map((s: Stage) => ({
      key: s,
      label: stageLabels[s],
      icon: stageIcons[s],
      count: jobOrders.filter((c: JobOrderCard) => c.stage === s).length,
    })),
  ]

  const visibleCards = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobOrders.filter((c: JobOrderCard) => {
      const matchesTab = activeTab === 'all' || c.stage === activeTab
      const matchesQuery =
        !q ||
        c.customer.toLowerCase().includes(q) ||
        c.plate.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q) ||
        c.vehicle.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      return matchesTab && matchesQuery
    })
  }, [activeTab, query, jobOrders])

  const total = visibleCards.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginatedCards = visibleCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6 p-8">
      <TopBar 
        title="Job Orders" 
        subtitle="Job order workflow & time tracking." 
        searchQuery={query}
        onSearchChange={setQuery}
      />

      <div className="flex w-fit flex-wrap items-center gap-2 rounded-full border border-border bg-card p-1.5">
        {tabs.map(({ key, label, count, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={14} />
              {label}
              <span
                className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${
                  active ? 'bg-white/20 text-brand-foreground' : 'bg-accent text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Loading job orders…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-12 text-center text-sm text-red-500">
          {error}
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No job orders match your search.
        </div>
      ) : (
        <>
          {/* Pagination controls */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} · {total} total job orders
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-accent disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Job orders table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Plate</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Mechanic</th>
                  <th className="px-4 py-3 font-semibold">Progress</th>
                  <th className="px-4 py-3 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedCards.map((c) => {
                  const StageIcon = stageIcons[c.stage]
                  return (
                    <tr key={c.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                            {c.customer.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{c.customer}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Car size={11} className="shrink-0" /> {c.vehicle}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Hash size={11} className="shrink-0" /> {c.customerId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {c.cancelled ? (
                          <span className="flex w-fit items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                            Cancelled by customer
                          </span>
                        ) : (
                          <span className="flex w-fit items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-muted-foreground">
                            <StageIcon size={12} />
                            {stageLabels[c.stage]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-foreground/80">
                        <span className="flex items-center gap-1.5">
                          <Wrench size={12} className="shrink-0 text-muted-foreground" /> {c.service}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-foreground/80">
                        <span className="flex items-center gap-1.5">
                          <Hash size={12} className="shrink-0 text-muted-foreground" /> {c.plate}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-foreground/80">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={12} className="shrink-0 text-muted-foreground" /> {c.time}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`font-semibold ${c.paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {c.paid ? 'Paid' : 'Unpaid'}
                        </span>
                        <p className="text-xs text-muted-foreground">{c.payment}</p>
                      </td>
                      <td className="px-4 py-4 text-foreground/80">
                        <span className="flex items-center gap-1.5">
                          <UserCog size={12} className="shrink-0 text-muted-foreground" /> {c.mechanic}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-xs text-muted-foreground">
                          {c.stepsDone}/{c.stepsTotal} steps
                        </p>
                        <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-accent">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${(c.stepsDone / c.stepsTotal) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/job-orders/${c.id}/${stageToRoute[c.stage]}`}
                          title="View Full Job Order"
                          className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent"
                        >
                          <Eye size={15} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}