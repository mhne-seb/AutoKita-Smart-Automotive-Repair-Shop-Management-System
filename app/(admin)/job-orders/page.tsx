'use client'

// Admin "Job Orders" board — lists every job order across all stages (inspecting/quotation/in-progress/completed), searchable and filterable by stage tab.
import { Fragment, useEffect, useMemo, useState, useRef } from 'react'
import Link from "next/link";
import { ClipboardList, Search, FileText, Wrench, CheckCircle2, ChevronLeft, ChevronRight, Car, Gauge, Receipt, SlidersHorizontal, X, Store, ChevronDown, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { avatarColorClass } from '@/lib/avatarColor'
import { getJobOrders, checkInJobOrder, getJobOrderDetails, type JobOrderDetails } from '@/controllers/jobOrderController'
import { arrivalWording } from '@/lib/serviceMode'
import { JobOrderCard, Stage, stageOrder, stageLabels } from '@/data/types'
import { ConfirmActionModal } from '@/components/ConfirmActionModal'
import { RequestedServices } from '@/components/admin/RequestedServices'
import { parseConcernText } from '@/lib/concernText'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

type TabKey = 'all' | Stage

const stageIcons: Record<Stage, typeof Search> = {
  inspecting: Search,
  quotation: FileText,
  'in-progress': Wrench,
  testing: Gauge,
  completed: Receipt,
  released: CheckCircle2,
}

const stagePillClasses: Record<Stage, string> = {
  inspecting: 'bg-accent text-muted-foreground',
  quotation: 'bg-violet-100 text-violet-700',
  'in-progress': 'bg-amber-100 text-amber-800',
  testing: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  released: 'bg-slate-100 text-slate-600',
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
  
  const [confirmCheckIn, setConfirmCheckIn] = useState<JobOrderCard | null>(null)

  // Local pagination state
  const [page, setPage] = useState(1)

  const [openId, setOpenId] = useState<string | null>(null)
  const [detailsById, setDetailsById] = useState<Record<string, JobOrderDetails | 'error'>>({})
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null)

  const toggleRow = async (id: string) => {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (detailsById[id] && detailsById[id] !== 'error') return
    setLoadingDetailsId(id)
    const details = await getJobOrderDetails(id)
    setDetailsById((prev) => ({ ...prev, [id]: details ?? 'error' }))
    setLoadingDetailsId((cur) => (cur === id ? null : cur))
  }

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
    setOpenId(null)
  }, [query, activeTab, selectedVehicle, selectedService, selectedMechanic, selectedPayment])

  const vehicleOptions = useMemo(
    () => Array.from(new Set(jobOrders.map((j) => j.vehicle).filter(Boolean))).sort(),
    [jobOrders]
  )
  // A job order's `service` is its services joined with ", ". Split it so each service is listed once.
  const serviceOptions = useMemo(
    () => Array.from(new Set(jobOrders.flatMap((j) => j.service.split(', ')).filter(Boolean))).sort(),
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
    setOpenId(null)
  }

  const [checkingInId, setCheckingInId] = useState<string | null>(null)

  const handleCheckIn = async (card: JobOrderCard) => {
    if (checkingInId) return
    setCheckingInId(card.id)
    try {
      const activeEmpId = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null
      const res = await checkInJobOrder(card.id, activeEmpId ? Number(activeEmpId) : undefined)
      if (res.success) {
        toast.success(arrivalWording(card.serviceMode ?? 'shop').toast)
        setJobOrders((prev) =>
          prev.map((j) =>
            j.id === card.id
              ? {
                  ...j,
                  arrived: true,
                  stepsDone: 1,
                  time: new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
                }
              : j
          )
        )
      } else {
        toast.error(res.message || 'Failed to check in vehicle')
      }
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed')
    } finally {
      setCheckingInId(null)
    }
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
      const matchesTab = activeTab === 'all' ? true : c.stage === activeTab
      const matchesQuery =
        !q ||
        c.customer.toLowerCase().includes(q) ||
        c.plate.toLowerCase().includes(q) ||
        c.service.toLowerCase().includes(q) ||
        c.vehicle.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)

      const matchesVehicle = selectedVehicle === 'all' || c.vehicle.toLowerCase() === selectedVehicle.toLowerCase()
      // Matches when the chosen service is ONE OF the job order's services.
      const matchesService =
        selectedService === 'all' ||
        c.service.toLowerCase().split(', ').includes(selectedService.toLowerCase())
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
              className={`cursor-pointer flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                active ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-brand-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
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
              } cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md`}
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
                      className="text-xs font-medium text-rose-500 hover:underline cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
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
                    className="rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
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
              onClick={() => {
                setOpenId(null)
                setPage((p) => Math.max(1, p - 1))
              }}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => {
                setOpenId(null)
                setPage((p) => Math.min(totalPages, p + 1))
              }}
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
              <button onClick={() => setSelectedVehicle('all')} className="hover:opacity-70 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><X size={12} /></button>
            </span>
          )}
          {selectedService !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Service: {selectedService}
              <button onClick={() => setSelectedService('all')} className="hover:opacity-70 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><X size={12} /></button>
            </span>
          )}
          {selectedMechanic !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Mechanic: {selectedMechanic}
              <button onClick={() => setSelectedMechanic('all')} className="hover:opacity-70 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><X size={12} /></button>
            </span>
          )}
          {selectedPayment !== 'all' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Payment: {selectedPayment === 'pending' ? 'Pending' : selectedPayment === 'unpaid' ? 'Unpaid' : 'Paid'}
              <button onClick={() => setSelectedPayment('all')} className="hover:opacity-70 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><X size={12} /></button>
            </span>
          )}
          <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-rose-500 hover:underline cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">
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
          <p>{error}</p>
          {error.toLowerCase().includes('log in') && (
            <Link
              href="/login"
              className="mt-3 inline-block rounded-xl bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-5 py-2 text-xs font-semibold text-white shadow hover:opacity-90 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
            >
              Sign In to AutoKita Admin
            </Link>
          )}
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
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Services</th>
                  <th className="px-4 py-3">Arrived</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Mechanic</th>
                  <th className="px-4 py-3 text-right">Stage</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCards.map((c) => {
                  const StageIcon = stageIcons[c.stage]
                  const w = arrivalWording(c.serviceMode ?? 'shop')
                  const servicesList = c.service.split(', ').filter(Boolean)
                  // The job order's services fill in as the quotation is built. Until then it holds only the scan
                  // fee (if any), so the customer's own request is the better thing to show.
                  const quotedList = servicesList.filter((n) => n !== DIAGNOSTIC_SCAN_SERVICE_NAME)
                  const request = parseConcernText(c.request)
                  const requestLabel = request.plain ?? request.category ?? request.groups[0]?.items[0] ?? null
                  const showRequest = quotedList.length === 0 && requestLabel !== null
                  const shownList = quotedList.length > 0 ? quotedList : servicesList
                  const firstService = shownList[0] || 'No services listed'
                  const moreCount = shownList.length - 1
                  const isOpen = openId === c.id

                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => toggleRow(c.id)}
                        className="cursor-pointer border-b border-border/60 hover:bg-accent/40 transition-colors align-middle"
                      >
                        <td className="px-4 py-4">
                          {c.queueNo != null ? (
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                              #{c.queueNo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorClass(
                                c.rawUserId || c.customerId
                              )}`}
                            >
                              {c.customer.charAt(0)}
                              {c.avatarUrl && (
                                <img
                                  src={c.avatarUrl}
                                  alt={c.customer}
                                  className="absolute inset-0 h-9 w-9 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{c.customer}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{c.vehicle}</p>
                              <p className="mt-0.5 text-xs font-medium text-foreground/80">{c.plate}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {showRequest ? (
                            <div>
                              <p className="max-w-[16rem] break-words font-semibold text-foreground line-clamp-2">{requestLabel}</p>
                              <p className="text-xs text-muted-foreground">Customer&apos;s request</p>
                              {c.serviceMode === 'home' && (
                                <div className="mt-1">
                                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                                    Home service
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : c.service === 'No services listed' ? (
                            <span className="text-muted-foreground">No services listed</span>
                          ) : (
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-foreground">{firstService}</span>
                                {moreCount > 0 && (
                                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                                    +{moreCount} more
                                  </span>
                                )}
                              </div>
                              {c.serviceMode === 'home' && (
                                <div className="mt-1">
                                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                                    Home service
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {c.arrived ? (
                            <span className="text-foreground">{c.time}</span>
                          ) : c.stage === 'inspecting' ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="italic text-muted-foreground">{w.notDone}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setConfirmCheckIn(c)
                                }}
                                disabled={checkingInId === c.id}
                                title={w.button}
                                className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 shadow-2xs hover:bg-amber-100 disabled:opacity-50 active:translate-y-0"
                              >
                                {checkingInId === c.id ? w.busy : w.button}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
                          <span>{c.mechanic}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {c.cancelled ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
                                Cancelled by customer
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                  stagePillClasses[c.stage]
                                }`}
                              >
                                <StageIcon size={12} />
                                {stageLabels[c.stage]}
                              </span>
                            )}
                            <ChevronDown
                              size={15}
                              className={`text-muted-foreground transition-transform duration-200 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border/60">
                          <td colSpan={7} className="bg-accent/30 px-6 py-5">
                            {loadingDetailsId === c.id ? (
                              <p className="text-sm text-muted-foreground">Loading details…</p>
                            ) : detailsById[c.id] === 'error' ? (
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>Could not load the details.</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDetailsById((prev) => {
                                      const next = { ...prev }
                                      delete next[c.id]
                                      return next
                                    })
                                    setOpenId(null)
                                    setTimeout(() => toggleRow(c.id), 0)
                                  }}
                                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                                >
                                  Try again
                                </button>
                              </div>
                            ) : detailsById[c.id] ? (
                              (() => {
                                const d = detailsById[c.id] as JobOrderDetails
                                const timelineW = arrivalWording(d.serviceMode)
                                return (
                                  <div className="space-y-5">
                                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                                      {/* What the customer asked for at booking */}
                                      {d.request && (
                                        <div className="col-span-full">
                                          <p className="text-xs text-muted-foreground">Customer&apos;s request</p>
                                          <RequestedServices raw={d.request} />
                                        </div>
                                      )}

                                      {/* Services on the job order: only once the quotation has services (the scan fee alone is not shown) */}
                                      {d.services.some((n) => n !== DIAGNOSTIC_SCAN_SERVICE_NAME) && (
                                        <div className="col-span-full">
                                          <p className="text-xs text-muted-foreground">
                                            On the job order ({d.services.length})
                                          </p>
                                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {d.services.length > 0 ? (
                                              d.services.map((s, idx) => (
                                                <span
                                                  key={idx}
                                                  className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground"
                                                >
                                                  {s}
                                                </span>
                                              ))
                                            ) : (
                                              <span className="text-xs text-muted-foreground">No services listed</span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Customer */}
                                      <div>
                                        <p className="text-xs text-muted-foreground">Customer</p>
                                        <div className="mt-1 space-y-0.5 text-sm text-foreground">
                                          <p className="font-medium">{c.customer}</p>
                                          {d.phone && (
                                            <p className="text-xs text-muted-foreground">{d.phone}</p>
                                          )}
                                          {d.email && (
                                            <p className="text-xs text-muted-foreground">{d.email}</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Vehicle */}
                                      <div>
                                        <p className="text-xs text-muted-foreground">Vehicle</p>
                                        <div className="mt-1 space-y-0.5 text-sm text-foreground">
                                          <p className="font-medium">{d.vehicle}</p>
                                          <p className="text-xs text-muted-foreground">Plate: {d.plate}</p>
                                          <p className="text-xs text-muted-foreground">Mileage: {d.mileage}</p>
                                        </div>
                                      </div>

                                      {/* Timeline */}
                                      <div>
                                        <p className="text-xs text-muted-foreground">Timeline</p>
                                        <div className="mt-1 space-y-1 text-sm text-foreground">
                                          <p className="text-xs">
                                            <span className="text-muted-foreground">{timelineW.done}: </span>
                                            {d.arrivedAt ?? timelineW.notDone}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span>
                                              <span className="text-muted-foreground">Ready by: </span>
                                              {d.readyBy || 'Not scheduled yet'}
                                            </span>
                                            {!d.readyBy && c.stage === 'in-progress' && (
                                              <Link
                                                href={`/job-orders/${c.id}/progress`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="font-medium text-brand hover:underline cursor-pointer"
                                              >
                                                Schedule job
                                              </Link>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Payment */}
                                      <div>
                                        <p className="text-xs text-muted-foreground">Payment</p>
                                        <div className="mt-1 space-y-0.5 text-sm text-foreground">
                                          <p className="text-xs">Total {d.total}</p>
                                          <p className="text-xs">Balance {d.balance}</p>
                                          <p className="text-xs font-semibold">
                                            Status:{' '}
                                            <span
                                              className={
                                                c.paymentStatus === 'Paid'
                                                  ? 'text-emerald-600'
                                                  : c.paymentStatus === 'Unpaid'
                                                  ? 'text-rose-600'
                                                  : 'text-amber-500'
                                              }
                                            >
                                              {c.paymentStatus || (c.paid ? 'Paid' : 'Unpaid')}
                                            </span>
                                          </p>
                                        </div>
                                      </div>

                                      {/* Mechanic */}
                                      <div>
                                        <p className="text-xs text-muted-foreground">Mechanic</p>
                                        <div className="mt-1 text-sm font-medium text-foreground">
                                          {c.mechanic}
                                        </div>
                                      </div>

                                      {/* Home service (only when d.serviceMode === 'home') */}
                                      {d.serviceMode === 'home' && (
                                        <div>
                                          <p className="text-xs text-muted-foreground">Home service</p>
                                          <div className="mt-1 space-y-1 text-sm text-foreground">
                                            {d.homeAddress && (
                                              <p className="flex items-start gap-1 text-xs">
                                                <MapPin size={13} className="mt-0.5 shrink-0 text-brand" />
                                                <span>{d.homeAddress}</span>
                                              </p>
                                            )}
                                            {d.visitTime && (
                                              <p className="text-xs text-muted-foreground">
                                                Arrival: {d.visitTime}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Bottom right: Open job order button */}
                                    <div className="flex justify-end pt-2">
                                      <Link
                                        href={`/job-orders/${c.id}/${stageToRoute[c.stage]}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-xs font-semibold text-brand-foreground shadow hover:opacity-95 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
                                      >
                                        Open job order
                                      </Link>
                                    </div>
                                  </div>
                                )
                              })()
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {confirmCheckIn && (
        <ConfirmActionModal
          tone="brand"
          title={arrivalWording(confirmCheckIn.serviceMode ?? 'shop').confirmTitle}
          description={arrivalWording(confirmCheckIn.serviceMode ?? 'shop').confirmText(
            confirmCheckIn.customer,
            confirmCheckIn.vehicle,
            confirmCheckIn.plate
          )}
          confirmLabel={arrivalWording(confirmCheckIn.serviceMode ?? 'shop').confirmLabel}
          busy={checkingInId === confirmCheckIn.id}
          onClose={() => setConfirmCheckIn(null)}
          onConfirm={async () => {
            await handleCheckIn(confirmCheckIn)
            setConfirmCheckIn(null)
          }}
        />
      )}
    </div>
  )
}