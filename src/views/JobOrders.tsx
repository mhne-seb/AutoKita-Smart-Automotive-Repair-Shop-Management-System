'use client'

// Admin "Job Orders" board — lists every job order across all stages (inspecting/quotation/in-progress/completed), searchable and filterable by stage tab.
import { useEffect, useMemo, useState } from 'react'
import Link from "next/link";
import { ClipboardList, Search, FileText, Wrench, CheckCircle2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { getJobOrders } from '@/controllers/jobOrderController'
import { JobOrderCard, Stage, stageOrder, stageLabels } from '../data/types'

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

export function JobOrders() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')

  const [jobOrders, setJobOrders] = useState<JobOrderCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getJobOrders(page, PAGE_SIZE)
      .then((result) => {
        if (!active) return
        setJobOrders(result.data)
        setTotalPages(result.totalPages)
        setTotal(result.total)
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
  }, [page])

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
        c.vehicle.toLowerCase().includes(q)
      return matchesTab && matchesQuery
    })
  }, [activeTab, query, jobOrders])

  return (
    <div className="space-y-6 p-8">
      <TopBar title="Job Orders" subtitle="Job order workflow & time tracking." />

      <div className="flex flex-wrap gap-3">
        {tabs.map(({ key, label, count, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} />
              {count} {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          Loading job orders…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-12 text-center text-sm text-red-500">
          {error}
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          No job orders match your search.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {visibleCards.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
                      {c.customer.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{c.customer}</p>
                      <p className="text-sm text-slate-400">{c.vehicle}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {stageLabels[c.stage]}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400">{c.customerId}</p>

                <Stepper stage={c.stage} />

                <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
                  <InfoField label="Service" value={c.service} />
                  <InfoField label="Time" value={c.time} />
                  <InfoField label="Plate" value={c.plate} prefix="#" />
                  <InfoField
                    label="Payment"
                    value={`${c.paid ? 'Paid' : 'Unpaid'} · ${c.payment}`}
                    valueClass={c.paid ? 'text-emerald-600' : 'text-amber-600'}
                  />
                  <div className="col-span-2">
                    <InfoField label="Assigned Mechanics" value={c.mechanic} />
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{c.stepsDone}/{c.stepsTotal} steps completed</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${(c.stepsDone / c.stepsTotal) * 100}%` }}
                    />
                  </div>
                </div>

                <Link
                  href={`/job-orders/${c.id}/${stageToRoute[c.stage]}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Eye size={15} /> View Full Job Order
                </Link>
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {total} total job orders
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stepper({ stage }: { stage: Stage }) {
  const currentIndex = stageOrder.indexOf(stage)

  return (
    <div className="mt-4 flex items-start">
      {stageOrder.map((s, i) => {
        const Icon = stageIcons[s]
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div className="flex max-w-[56px] flex-col items-center gap-1">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-slate-900/40" />
                )}
                <div
                  className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-300 ${
                    done || active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-300'
                  } ${active ? 'scale-110' : ''}`}
                >
                  <Icon size={14} />
                </div>
              </div>
              <span
                className={`text-center text-[6.5px] font-semibold uppercase leading-tight tracking-tighter transition-colors duration-300 ${
                  done || active ? 'text-slate-900' : 'text-slate-300'
                }`}
              >
                {stageLabels[s]}
              </span>
            </div>
            {i < stageOrder.length - 1 && (
              <div className={`-mt-4 h-0.5 flex-1 transition-colors duration-300 ${done ? 'bg-slate-900' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoField({
  label,
  value,
  prefix,
  valueClass = 'text-slate-800',
}: {
  label: string
  value: string
  prefix?: string
  valueClass?: string
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{prefix ? `${prefix} ${label}` : label}</p>
      <p className={`font-semibold ${valueClass}`}>{value}</p>
    </div>
  )
}