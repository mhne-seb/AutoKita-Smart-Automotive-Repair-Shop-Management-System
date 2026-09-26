'use client'

// Admin "Job Orders" board — lists every job order across all stages (inspecting/quotation/in-progress/completed), searchable and filterable by stage tab.
import { useEffect, useMemo, useState, useRef } from 'react'
import Link from "next/link";
import { ClipboardList, Search, FileText, Wrench, CheckCircle2, Eye, ChevronLeft, ChevronRight, Car, Hash, Calendar, UserCog, Gauge, Receipt, SlidersHorizontal, X } from 'lucide-react'
import { TopBar } from '@/components/TopBar'
import { getJobOrders } from '@/controllers/jobOrderController'
import { JobOrderCard, Stage, stageOrder, stageLabels } from '@/data/types'

type TabKey = 'all' | Stage

const stageIcons: Record<Stage, typeof Search> = {
  inspecting: Search,
  quotation: FileText,
  'in-progress': Wrench,
  testing: Gauge,
  completed: Receipt,
  released: CheckCircle2,
}

const PAGE_SIZE = 12

// Maps each job-order stage to the page that handles it. "completed" has no
// separate page of its own — a finished job order is just the Service
// Progress page with every task checked off (see ServiceProgress.tsx).
const stageToRoute: Record<Stage, string> = {
  inspecting: 'inspection',
  quotation: 'quotation',
  'in-progress': 'progress',
  testing: 'testing',
  completed: 'billing',
  released: 'completed',
}

export default function page() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [query, setQuery] = useState('')

  // Filter criteria states
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all')
  const [selectedService, setSelectedService] = useState<string>('all')
  const [selectedMechanic, setSelectedMechanic] = useState<string>('all')
  const [selectedPayment, setSelectedPayment] = useState<string>('all')
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)

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

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false)
      }
    }
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showFilterMenu])

  useEffect(() => {
    setPage(1)
  }, [query, activeTab, selectedVehicle, selectedService, selectedMechanic, selectedPayment])

  const vehicleOptions = useMemo(
    () => Array.from(new Set(jobOrders.map((j) => j.vehicle).filter(Boolean))).sort(),
    [jobOrders]
  )
  const serviceOptions = useMemo(
    () => Array.from(new Set(jobOrders.map((j) => j.service).filter(Boolean))).sort(),
    [jobOrders]
  )
  const mechanicOptions = useMemo(
    () => Array.from(new Set(jobOrders.map((j) => j.mechanic).filter(Boolean))).sort(),
    [jobOrders]
  )

  const activeFilterCount =
    (selectedVehicle !== 'all' ? 1 : 0) +
    (selectedService !== 'all' ? 1 : 0) +
    (selectedMechanic !== 'all' ? 1 : 0) +
    (selectedPayment !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setSelectedVehicle('all')
    setSelectedService('all')
    setSelectedMechanic('all')
    setSelectedPayment('all')
    setPage(1)
  }

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

      const matchesVehicle = selectedVehicle === 'all' || c.vehicle.toLowerCase() === selectedVehicle.toLowerCase()
      const matchesService = selectedService === 'all' || c.service.toLowerCase() === selectedService.toLowerCase()
      const matchesMechanic = selectedMechanic === 'all' || c.mechanic.toLowerCase() === selectedMechanic.toLowerCase()
      const matchesPayment =
        selectedPayment === 'all' ||
        (selectedPayment === 'paid' && c.paymentStatus === 'Paid') ||
        (selectedPayment === 'unpaid' && c.paymentStatus === 'Unpaid') ||
        (selectedPayment === 'pending' && c.paymentStatus === 'Pending')

      return matchesTab && matchesQuery && matchesVehicle && matchesService && matchesMechanic && matchesPayment
    })
  }, [activeTab, query, selectedVehicle, selectedService, selectedMechanic, selectedPayment, jobOrders])

  const total = visibleCards.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const paginatedCards = visibleCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <TopBar 
        title="Job Orders" 
        subtitle="Job order workflow & time tracking." 
        showSearch={false}
      />

      <div className="flex w-fit max-w-full items-center gap-2 overflow-x-auto rounded-full border border-border bg-card p-1.5">
        {tabs.map(({ key, label, count, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
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

      {/* Unified Toolbar: Page count on left, Search Bar next to Filter next to Prev/Next buttons on right */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Page {page} of {totalPages} · {total} total job orders
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search orders, plates, customer..."
              className="w-56 sm:w-64 rounded-xl border border-border bg-card py-2 pl-9 pr-7 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-all focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Popover Button & Menu */}
          <div className="relative" ref={filterMenuRef}>
            <button
              onClick={() => setShowFilterMenu((v) => !v)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold shadow-sm transition-all ${
                activeFilterCount > 0
                  ? 'border-brand bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-brand-foreground'
                  : 'border-border bg-card text-foreground hover:bg-accent'
              }`}
            >
              <SlidersHorizontal size={15} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 z-30 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-card p-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <SlidersHorizontal size={15} className="text-brand" />
                    <span>Filter Job Orders</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="text-xs font-medium text-rose-500 hover:underline"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-3.5">
                  {/* Vehicle */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle</label>
                    <select
                      value={selectedVehicle}
                      onChange={(e) => setSelectedVehicle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                    >
                      <option value="all">All Vehicles</option>
                      {vehicleOptions.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  {/* Service */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Service</label>
                    <select
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                    >
                      <option value="all">All Services</option>
                      {serviceOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mechanic */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mechanic</label>
                    <select
                      value={selectedMechanic}
                      onChange={(e) => setSelectedMechanic(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                    >
                      <option value="all">All Mechanics</option>
                      {mechanicOptions.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Payment */}
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Payment Status</label>
                    <select
                      value={selectedPayment}
                      onChange={(e) => setSelectedPayment(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                    >
                      <option value="all">All Payment Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex justify-end border-t border-border pt-3">
                  <button
                    onClick={() => setShowFilterMenu(false)}
                    className="rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Prev / Next Pagination */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Active filter chips (if any) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Active Filters:</span>
          {selectedVehicle !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Vehicle: {selectedVehicle}
              <button onClick={() => setSelectedVehicle('all')} className="hover:opacity-70"><X size={12} /></button>
            </span>
          )}
          {selectedService !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Service: {selectedService}
              <button onClick={() => setSelectedService('all')} className="hover:opacity-70"><X size={12} /></button>
            </span>
          )}
          {selectedMechanic !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Mechanic: {selectedMechanic}
              <button onClick={() => setSelectedMechanic('all')} className="hover:opacity-70"><X size={12} /></button>
            </span>
          )}
          {selectedPayment !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Payment: {selectedPayment === 'pending' ? 'Pending' : selectedPayment === 'unpaid' ? 'Unpaid' : 'Paid'}
              <button onClick={() => setSelectedPayment('all')} className="hover:opacity-70"><X size={12} /></button>
            </span>
          )}
          <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-rose-500 hover:underline">
            Clear all
          </button>
        </div>
      )}

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
          No job orders match your search or filter criteria.
        </div>
      ) : (
        /* Job orders table */
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
                        <span
                          className={`font-semibold ${
                            c.paymentStatus === 'Paid'
                              ? 'text-emerald-600'
                              : c.paymentStatus === 'Unpaid'
                              ? 'text-rose-600'
                              : 'text-amber-500'
                          }`}
                        >
                          {c.paymentStatus || (c.paid ? 'Paid' : 'Unpaid')}
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
      )}
    </div>
  )
}