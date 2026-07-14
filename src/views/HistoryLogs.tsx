'use client'

import { useMemo, useState } from 'react'
import Link from "next/link";
import {
  Search,
  Calendar,
  Car,
  Filter,
  Download,
  Eye,
  ClipboardList,
  Ticket,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Wallet,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  Check,
} from 'lucide-react'
import {
  jobOrderHistory,
  jobOrderHistorySummary,
  ticketHistory,
  ticketHistorySummary,
  customerHistory,
  customerHistorySummary,
  currency,
  type HistoryStatus,
  type CustomerTier,
} from '@/controllers/historyController'

export type HistoryTab = 'job-orders' | 'tickets' | 'customers'

interface Props {
  tab: HistoryTab
}

type PopoverKey = 'date-top' | 'date-table' | 'vehicle' | 'filter' | null

const TAB_META: { key: HistoryTab; label: string; to: string; icon: typeof ClipboardList }[] = [
  { key: 'job-orders', label: 'Job Orders', to: '/history/job-orders', icon: ClipboardList },
  { key: 'tickets', label: 'Tickets', to: '/history/tickets', icon: Ticket },
  { key: 'customers', label: 'Customers', to: '/history/customers', icon: Users },
]

const PAGE_TITLES: Record<HistoryTab, string> = {
  'job-orders': 'Job Orders History',
  tickets: 'Tickets History',
  customers: 'Customers History',
}

const SEARCH_PLACEHOLDERS: Record<HistoryTab, string> = {
  'job-orders': 'Search by job order id, name, vehicle...',
  tickets: 'Search by ticket id, name, contact...',
  customers: 'Search by customer name, number, vehicle...',
}

function statusClasses(status: HistoryStatus) {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-700'
    case 'Cancelled':
      return 'bg-rose-100 text-rose-700'
    case 'Pending':
      return 'bg-amber-100 text-amber-700'
  }
}

function tierClasses(tier: CustomerTier) {
  switch (tier) {
    case 'VIP':
      return 'bg-slate-900 text-white'
    case 'Loyal Customer':
      return 'bg-emerald-500 text-white'
    case 'Regular':
      return 'bg-slate-100 text-slate-600'
    case 'New':
      return 'bg-slate-100 text-slate-500'
  }
}

// Turns camelCase keys like "customerId" into "Customer ID" for the detail modal
function humanizeKey(key: string) {
  const spaced = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
  return spaced.replace(/\bId\b/g, 'ID')
}

// Turns an array of flat objects into a CSV file and triggers a browser
// download — good enough for a mock "Export" button without a backend.
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function HistoryLogs({ tab }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // ---- New: functional filter controls ----
  const [openPopover, setOpenPopover] = useState<PopoverKey>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('All Vehicles')
  const [branchFilter, setBranchFilter] = useState('All Branches')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [tierFilter, setTierFilter] = useState('All Tiers')

  // ---- New: view details modal ----
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)

  function togglePopover(key: PopoverKey) {
    setOpenPopover((prev) => (prev === key ? null : key))
  }

  function resetFilters() {
    setQuery('')
    setStatusFilter('All Statuses')
    setDateFrom('')
    setDateTo('')
    setVehicleFilter('All Vehicles')
    setBranchFilter('All Branches')
    setTypeFilter('All Types')
    setTierFilter('All Tiers')
    setOpenPopover(null)
    setPage(1)
  }

  // Unique option lists, derived from the full (unfiltered) dataset per tab
  const vehicleOptions = useMemo(() => {
    const source = tab === 'job-orders' ? jobOrderHistory : tab === 'tickets' ? ticketHistory : customerHistory
    return Array.from(new Set(source.map((r) => r.vehicle))).sort()
  }, [tab])

  const branchOptions = useMemo(() => Array.from(new Set(jobOrderHistory.map((r) => r.branch))).sort(), [])
  const typeOptions = useMemo(() => Array.from(new Set(ticketHistory.map((r) => r.type))).sort(), [])
  const tierOptions = useMemo(() => Array.from(new Set(customerHistory.map((r) => r.tier))).sort(), [])

  function inDateRange(dateStr: string | undefined) {
    if (!dateFrom && !dateTo) return true
    if (!dateStr) return true
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return true
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false
    return true
  }

  // ---- Job Orders ---------------------------------------------------------
  const filteredJobOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobOrderHistory.filter((row) => {
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.vehicle.toLowerCase().includes(q) ||
        row.customerId.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All Statuses' || row.status === statusFilter
      const matchesVehicle = vehicleFilter === 'All Vehicles' || row.vehicle === vehicleFilter
      const matchesBranch = branchFilter === 'All Branches' || row.branch === branchFilter
      return matchesQuery && matchesStatus && matchesVehicle && matchesBranch && inDateRange(row.date)
    })
  }, [query, statusFilter, vehicleFilter, branchFilter, dateFrom, dateTo])

  // ---- Tickets -------------------------------------------------------------
  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ticketHistory.filter((row) => {
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.contact.toLowerCase().includes(q) ||
        row.vehicle.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All Statuses' || row.status === statusFilter
      const matchesVehicle = vehicleFilter === 'All Vehicles' || row.vehicle === vehicleFilter
      const matchesType = typeFilter === 'All Types' || row.type === typeFilter
      return matchesQuery && matchesStatus && matchesVehicle && matchesType
    })
  }, [query, statusFilter, vehicleFilter, typeFilter])

  // ---- Customers -----------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return customerHistory.filter((row) => {
      const matchesQuery =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.customerId.toLowerCase().includes(q) ||
        row.vehicle.toLowerCase().includes(q)
      const matchesPayment = statusFilter === 'All Statuses' || row.payment === statusFilter
      const matchesVehicle = vehicleFilter === 'All Vehicles' || row.vehicle === vehicleFilter
      const matchesTier = tierFilter === 'All Tiers' || row.tier === tierFilter
      return matchesQuery && matchesPayment && matchesVehicle && matchesTier && inDateRange(row.lastService)
    })
  }, [query, statusFilter, vehicleFilter, tierFilter, dateFrom, dateTo])

  const activeRows =
    tab === 'job-orders' ? filteredJobOrders : tab === 'tickets' ? filteredTickets : filteredCustomers

  const totalPages = Math.max(1, Math.ceil(activeRows.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * rowsPerPage
  const pageRows = activeRows.slice(pageStart, pageStart + rowsPerPage)

  const statusOptions =
    tab === 'customers' ? ['All Statuses', 'Paid', 'Unpaid'] : ['All Statuses', 'Completed', 'Cancelled', 'Pending']

  function handleExport() {
    if (tab === 'job-orders') downloadCsv('job-orders-history.csv', filteredJobOrders)
    else if (tab === 'tickets') downloadCsv('tickets-history.csv', filteredTickets)
    else downloadCsv('customers-history.csv', filteredCustomers)
  }

  const idKey = tab === 'customers' ? 'customerId' : 'id'
  const activeFilterCount =
    (vehicleFilter !== 'All Vehicles' ? 1 : 0) +
    (branchFilter !== 'All Branches' && tab === 'job-orders' ? 1 : 0) +
    (typeFilter !== 'All Types' && tab === 'tickets' ? 1 : 0) +
    (tierFilter !== 'All Tiers' && tab === 'customers' ? 1 : 0)
  const dateActive = Boolean(dateFrom || dateTo)

  // ---- Shared popover content builders ----
  function DateRangePopover() {
    return (
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filter by Date</p>
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-semibold text-slate-500">
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-500">
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
          </label>
        </div>
        {tab === 'tickets' && (
          <p className="mt-2 text-[11px] text-slate-400">Note: date data isn't tracked for tickets, so this filter has no effect on this tab.</p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => {
              setDateFrom('')
              setDateTo('')
            }}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
          <button
            onClick={() => {
              setPage(1)
              setOpenPopover(null)
            }}
            className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Check size={12} /> Apply
          </button>
        </div>
      </div>
    )
  }

  function VehiclePopover() {
    return (
      <div className="absolute right-0 z-20 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Filter by Vehicle</p>
        <button
          onClick={() => {
            setVehicleFilter('All Vehicles')
            setPage(1)
            setOpenPopover(null)
          }}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
            vehicleFilter === 'All Vehicles' ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Vehicles
          {vehicleFilter === 'All Vehicles' && <Check size={13} />}
        </button>
        {vehicleOptions.map((v) => (
          <button
            key={v}
            onClick={() => {
              setVehicleFilter(v)
              setPage(1)
              setOpenPopover(null)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
              vehicleFilter === v ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {v}
            {vehicleFilter === v && <Check size={13} />}
          </button>
        ))}
      </div>
    )
  }

  function AdvancedFilterPopover() {
    const options = tab === 'job-orders' ? branchOptions : tab === 'tickets' ? typeOptions : tierOptions
    const allLabel = tab === 'job-orders' ? 'All Branches' : tab === 'tickets' ? 'All Types' : 'All Tiers'
    const currentValue = tab === 'job-orders' ? branchFilter : tab === 'tickets' ? typeFilter : tierFilter
    const setValue = tab === 'job-orders' ? setBranchFilter : tab === 'tickets' ? setTypeFilter : setTierFilter
    const heading = tab === 'job-orders' ? 'Filter by Branch' : tab === 'tickets' ? 'Filter by Type' : 'Filter by Tier'

    return (
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
        <button
          onClick={() => {
            setValue(allLabel)
            setPage(1)
            setOpenPopover(null)
          }}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
            currentValue === allLabel ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {allLabel}
          {currentValue === allLabel && <Check size={13} />}
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setValue(opt)
              setPage(1)
              setOpenPopover(null)
            }}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
              currentValue === opt ? 'bg-slate-900 text-white font-semibold' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {opt}
            {currentValue === opt && <Check size={13} />}
          </button>
        ))}
      </div>
    )
  }

  function renderDetailValue(key: string, value: unknown) {
    if (key === 'status') {
      return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(value as HistoryStatus)}`}>{String(value)}</span>
    }
    if (key === 'tier') {
      return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tierClasses(value as CustomerTier)}`}>{String(value)}</span>
    }
    if (key === 'payment') {
      return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {String(value)}
        </span>
      )
    }
    if (key === 'type') {
      return (
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value === 'Home Service' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {String(value)}
        </span>
      )
    }
    if (typeof value === 'number' && /total|spent|revenue/i.test(key)) {
      return <span className="font-semibold text-slate-800">{currency(value)}</span>
    }
    return <span className="text-slate-700">{String(value)}</span>
  }

  return (
    <div className="space-y-6 p-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-900">{PAGE_TITLES[tab]}</h1>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Download size={15} /> Export Reports
        </button>
      </div>

      {/* Top filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search by service type or booking ID..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => togglePopover('date-top')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 ${
              dateActive ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 bg-white'
            }`}
          >
            <Calendar size={15} /> Date Range {dateActive && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
          </button>
          {openPopover === 'date-top' && <DateRangePopover />}
        </div>

        <div className="relative">
          <button
            onClick={() => togglePopover('vehicle')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 ${
              vehicleFilter !== 'All Vehicles' ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 bg-white'
            }`}
          >
            <Car size={15} /> {vehicleFilter === 'All Vehicles' ? 'Vehicle' : vehicleFilter}
          </button>
          {openPopover === 'vehicle' && <VehiclePopover />}
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <button onClick={resetFilters} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
          Reset Filters
        </button>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-2 rounded-full bg-slate-100 p-1.5">
        {TAB_META.map(({ key, label, to, icon: Icon }) => {
          const active = key === tab
          return (
            <Link
              key={key}
              href={to}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={15} /> {label}
            </Link>
          )
        })}
      </div>

      {/* Stat cards */}
      {tab === 'job-orders' && (
        <div className="flex flex-wrap gap-4">
          <StatMini icon={ClipboardList} iconBg="bg-slate-100" iconColor="text-slate-700" label="Total Job Orders" value={jobOrderHistorySummary.total.toLocaleString()} />
          <StatMini icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Completed" value={jobOrderHistorySummary.completed.toLocaleString()} />
          <StatMini icon={XCircle} iconBg="bg-rose-100" iconColor="text-rose-600" label="Cancelled" value={jobOrderHistorySummary.cancelled.toLocaleString()} />
          <StatMini icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" label="Pending" value={jobOrderHistorySummary.pending.toLocaleString()} />
        </div>
      )}
      {tab === 'tickets' && (
        <div className="flex flex-wrap gap-4">
          <StatMini icon={Ticket} iconBg="bg-slate-100" iconColor="text-slate-700" label="Total Tickets" value={ticketHistorySummary.total.toLocaleString()} />
          <StatMini icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Completed" value={ticketHistorySummary.completed.toLocaleString()} />
          <StatMini icon={XCircle} iconBg="bg-rose-100" iconColor="text-rose-600" label="Cancelled" value={ticketHistorySummary.cancelled.toLocaleString()} />
          <StatMini icon={Clock} iconBg="bg-amber-100" iconColor="text-amber-600" label="Pending" value={ticketHistorySummary.pending.toLocaleString()} />
        </div>
      )}
      {tab === 'customers' && (
        <div className="flex flex-wrap gap-4">
          <StatMini icon={Users} iconBg="bg-slate-100" iconColor="text-slate-700" label="Total Customers" value={customerHistorySummary.total.toLocaleString()} />
          <StatMini icon={CheckCircle2} iconBg="bg-emerald-100" iconColor="text-emerald-600" label="Fully Paid" value={customerHistorySummary.fullyPaid.toLocaleString()} />
          <StatMini icon={AlertCircle} iconBg="bg-rose-100" iconColor="text-rose-600" label="Outstanding" value={customerHistorySummary.outstanding.toLocaleString()} />
          <StatMini icon={Wallet} iconBg="bg-amber-100" iconColor="text-amber-600" label="Total Revenue" value={`₱${(customerHistorySummary.totalRevenue / 1_000_000).toFixed(2)}M`} />
        </div>
      )}

      {/* Branch badge — only shown for Job Orders, matching the reference design */}
      {tab === 'job-orders' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
            <MapPin size={13} /> AutoKita - {branchFilter === 'All Branches' ? 'Main Branch' : branchFilter} · filtered
          </span>
          <span className="text-slate-400">{activeRows.length} records found</span>
        </div>
      )}

      {/* Table toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={SEARCH_PLACEHOLDERS[tab]}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>

        <div className="relative">
          <button
            onClick={() => togglePopover('date-table')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 ${
              dateActive ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 bg-white'
            }`}
          >
            <Calendar size={15} /> Date Range {dateActive && <span className="h-1.5 w-1.5 rounded-full bg-slate-900" />}
          </button>
          {openPopover === 'date-table' && <DateRangePopover />}
        </div>

        <div className="relative">
          <button
            onClick={() => togglePopover('filter')}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 ${
              activeFilterCount > 0 ? 'border-slate-900 text-slate-900 bg-slate-50' : 'border-slate-200 text-slate-600 bg-white'
            }`}
          >
            <Filter size={15} /> Filter {activeFilterCount > 0 && <span className="rounded-full bg-slate-900 px-1.5 text-[10px] text-white">{activeFilterCount}</span>}
          </button>
          {openPopover === 'filter' && <AdvancedFilterPopover />}
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Download size={15} /> Export
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          {tab === 'job-orders' && (
            <>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Job Order ID</th>
                  <th className="px-4 py-3 font-semibold">Customer No.</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Shop / Branch</th>
                  <th className="px-4 py-3 font-semibold">Services</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-slate-400">No job orders match your search or filters.</td>
                  </tr>
                ) : (
                  (pageRows as typeof jobOrderHistory).map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">{row.id}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.customerId}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.vehicle}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.branch}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.services}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{currency(row.total)}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.date}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => setSelectedRow(row)} aria-label="View details" className="text-slate-400 hover:text-slate-700">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {tab === 'tickets' && (
            <>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Ticket ID</th>
                  <th className="px-4 py-3 font-semibold">Customer No.</th>
                  <th className="px-4 py-3 font-semibold">Customer Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Services</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-slate-400">No tickets match your search or filters.</td>
                  </tr>
                ) : (
                  (pageRows as typeof ticketHistory).map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">{row.id}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.customerId}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.contact}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.vehicle}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.type === 'Home Service' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{row.services}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => setSelectedRow(row)} aria-label="View details" className="text-slate-400 hover:text-slate-700">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {tab === 'customers' && (
            <>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Customer No.</th>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Jobs</th>
                  <th className="px-4 py-3 font-semibold">Total Spent</th>
                  <th className="px-4 py-3 font-semibold">Last Service</th>
                  <th className="px-4 py-3 font-semibold">Payment</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-slate-400">No customers match your search or filters.</td>
                  </tr>
                ) : (
                  (pageRows as typeof customerHistory).map((row) => (
                    <tr key={row.customerId} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">{row.customerId}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.contact}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.vehicle}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{row.jobs}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">{currency(row.totalSpent)}</td>
                      <td className="px-4 py-3.5 text-slate-500">{row.lastService}</td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.payment === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {row.payment}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tierClasses(row.tier)}`}>{row.tier}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={() => setSelectedRow(row)} aria-label="View details" className="text-slate-400 hover:text-slate-700">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            Showing {activeRows.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + rowsPerPage, activeRows.length)} of{' '}
            {activeRows.length} records
          </span>
          <label className="flex items-center gap-1.5">
            Rows per page:
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setPage(1)
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm font-semibold text-slate-700"
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.min(totalPages, 3) }).map((_, i) => {
            const n = i + 1
            return (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                  currentPage === n ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {n}
              </button>
            )
          })}
          {totalPages > 3 && <span className="px-1 text-slate-300">…</span>}
          {totalPages > 3 && (
            <button
              onClick={() => setPage(totalPages)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                currentPage === totalPages ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {totalPages}
            </button>
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* View details modal */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {tab === 'job-orders' ? 'Job Order' : tab === 'tickets' ? 'Ticket' : 'Customer'} Record
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{String(selectedRow.name)}</h3>
                <p className="text-sm text-slate-400">{String(selectedRow[idKey])}</p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              {Object.entries(selectedRow)
                .filter(([key]) => key !== 'name' && key !== idKey)
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-slate-500">{humanizeKey(key)}</span>
                    {renderDetailValue(key, value)}
                  </div>
                ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedRow(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatMini({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: typeof ClipboardList
  iconBg: string
  iconColor: string
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-[220px] flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}
