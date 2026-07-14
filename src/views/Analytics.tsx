'use client'

import { useEffect, useMemo, useState } from 'react'
import ExcelJS from 'exceljs'
import { Download, Info, Gift, Search, Check } from 'lucide-react'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { StatusBadge } from '../components/StatusBadge'
import { getRevenueTrend, getChurnList } from '@/controllers/reportController'
import { currency } from '../data/mockData'

// ---- Churn classification helpers -------------------------------------

/**
 * Decides churn status label for a customer, matching the exact strings
 * used in StatusBadge's `styles` map: 'New Customer', 'High Churn Risk',
 * 'Medium Churn Risk', 'Loyal Customer'.
 */
function getDaysSince(dateStr?: string) {
  if (!dateStr) return Infinity
  const last = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.floor((now - last) / (1000 * 60 * 60 * 24))
}

function computeChurnStatus(c: any): string {
  const serviceCount = c.serviceCount ?? (c.lastCheckup ? 1 : 0)
  if (serviceCount < 2) return 'New Customer'

  const days = getDaysSince(c.lastCheckup)
  if (days > 180) return 'High Churn Risk'
  if (days > 90) return 'Medium Churn Risk'
  return 'Loyal Customer'
}

const STATUS_FILTERS: { label: string; value: 'all' | string }[] = [
  { label: 'All Customers', value: 'all' },
  { label: 'New Customer', value: 'New Customer' },
  { label: 'High Churn Risk', value: 'High Churn Risk' },
  { label: 'Medium Churn Risk', value: 'Medium Churn Risk' },
  { label: 'Loyal Customer', value: 'Loyal Customer' },
]

const TIME_RANGES = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'All Time', value: Infinity },
]

// Header/status brand colors, echoing the badge colors used in StatusBadge.
const STATUS_FILL: Record<string, string> = {
  'High Churn Risk': 'FFFEE2E2',
  'Medium Churn Risk': 'FFFEF3C7',
  'Loyal Customer': 'FFD1FAE5',
  'New Customer': 'FFE0F2FE',
}
const STATUS_FONT: Record<string, string> = {
  'High Churn Risk': 'FFB91C1C',
  'Medium Churn Risk': 'FF92400E',
  'Loyal Customer': 'FF065F46',
  'New Customer': 'FF0369A1',
}

async function buildChurnReportWorkbook(rows: any[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AutoKita Admin'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Churn Report', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  // --- Company logo, embedded top-left of the title band -----------------
  try {
    const logoBuffer = await fetch('/autokita-logo.png').then((r) => r.arrayBuffer())
    const imageId = workbook.addImage({ buffer: logoBuffer as any, extension: 'png' })
    sheet.addImage(imageId, {
      tl: { col: 0.15, row: 0.1 },
      ext: { width: 28, height: 28 },
    })
  } catch {
    // Non-fatal — report still generates without the logo if the fetch fails.
  }

  sheet.mergeCells('B1:H1')
  const titleCell = sheet.getCell('B1')
  titleCell.value = `AutoKita — Churn Report (Generated ${new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })})`
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 34

  const columns = [
    { header: 'Customer ID', key: 'customerId', width: 18 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Contact', key: 'contact', width: 18 },
    { header: 'Status', key: 'churnStatus', width: 20 },
    { header: 'Vehicle (Year & Model)', key: 'vehicle', width: 24 },
    { header: 'Mileage', key: 'mileage', width: 12 },
    { header: 'Last Checkup', key: 'lastCheckup', width: 14 },
    { header: 'Promotional Offer', key: 'offer', width: 32 },
  ]
  sheet.columns = columns

  const headerRow = sheet.getRow(2)
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })
  headerRow.height = 22
  sheet.autoFilter = { from: 'A2', to: 'H2' }

  rows.forEach((c) => {
    const row = sheet.addRow({
      customerId: c.customerId,
      name: c.name,
      contact: c.contact,
      churnStatus: c.churnStatus,
      vehicle: c.vehicle,
      mileage: c.mileage,
      lastCheckup: c.lastCheckup ?? '—',
      offer: c.offer ?? '—',
    })

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle' }
    })

    const statusCell = row.getCell(4)
    const fill = STATUS_FILL[c.churnStatus]
    const font = STATUS_FONT[c.churnStatus]
    if (fill) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      statusCell.font = { bold: true, color: { argb: font ?? 'FF334155' } }
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  })

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        if (!cell.fill || (cell.fill as any).fgColor === undefined) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
    }
  })

  return workbook
}

async function downloadChurnReport(rows: any[], filename: string) {
  const workbook = await buildChurnReportWorkbook(rows)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Catalog of offers the admin can choose from when reaching out to a customer.
// `recommendedFor` just pre-selects a sensible default based on churn status —
// admin can still pick a different one before confirming.
const OFFER_CATALOG = [
  {
    id: 'free-oil-change',
    label: 'Free Oil Change Reminder',
    description: 'No-cost oil change coupon, good for one visit.',
    recommendedFor: ['High Churn Risk'],
  },
  {
    id: 'discount-15',
    label: '15% Discount Maintenance Promo',
    description: '15% off any single maintenance service.',
    recommendedFor: ['Medium Churn Risk'],
  },
  {
    id: 'discount-25',
    label: '25% Win-Back Discount',
    description: 'Bigger discount reserved for high-risk, high-value customers.',
    recommendedFor: ['High Churn Risk'],
  },
  {
    id: 'quick-service',
    label: 'Quick-Service Special Offer',
    description: 'Priority scheduling + minor perks for loyal customers.',
    recommendedFor: ['Loyal Customer'],
  },
  {
    id: 'welcome-promo',
    label: 'Welcome New Customer Promo',
    description: 'Intro discount for customers on their first visit.',
    recommendedFor: ['New Customer'],
  },
  {
    id: 'loyalty-points',
    label: 'Bonus Loyalty Points',
    description: 'Extra points added to the customer’s rewards balance.',
    recommendedFor: ['Loyal Customer', 'Medium Churn Risk'],
  },
  {
    id: 'custom',
    label: 'Custom Offer',
    description: 'Write your own offer text for this customer.',
    recommendedFor: [],
  },
] as const

export function Analytics() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<number>(Infinity)
  const [search, setSearch] = useState('')
  const [offersSent, setOffersSent] = useState<Record<string, string>>({})

  // Loaded through the controller (mock API) — see reportController.ts.
  const [churnList, setChurnList] = useState<any[]>([])
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])

  useEffect(() => {
    let active = true
    getChurnList().then((data) => active && setChurnList(data))
    getRevenueTrend().then((data) => active && setRevenueTrend(data))
    return () => {
      active = false
    }
  }, [])

  // Offer modal state
  const [offerTarget, setOfferTarget] = useState<any | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [customOfferText, setCustomOfferText] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2500)
  }

  // Normalize the raw list so every row has a computed churnStatus,
  const normalizedList = useMemo(
    () =>
      churnList.map((c: any) => ({
        ...c,
        churnStatus: c.churnStatus ?? computeChurnStatus(c),
      })),
    [churnList]
  )

  const timeFilteredList = useMemo(() => {
    if (!Number.isFinite(timeRange)) return normalizedList
    return normalizedList.filter((c: any) => getDaysSince(c.lastCheckup) <= timeRange)
  }, [normalizedList, timeRange])

  const filteredList = useMemo(() => {
    return timeFilteredList.filter((c: any) => {
      const matchesStatus = statusFilter === 'all' || c.churnStatus === statusFilter
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        c.name?.toLowerCase().includes(q) ||
        c.customerId?.toLowerCase().includes(q) ||
        c.contact?.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [timeFilteredList, statusFilter, search])

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: timeFilteredList.length,
      'New Customer': 0,
      'High Churn Risk': 0,
      'Medium Churn Risk': 0,
      'Loyal Customer': 0,
    }
    timeFilteredList.forEach((c: any) => {
      base[c.churnStatus] = (base[c.churnStatus] ?? 0) + 1
    })
    return base
  }, [timeFilteredList])

  function handleExport() {
    if (filteredList.length === 0) {
      showToast('Nothing to export for the current filters.')
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadChurnReport(filteredList, `churn-report-${stamp}.xlsx`)
      .then(() => {
        showToast(`Exported ${filteredList.length} customer${filteredList.length > 1 ? 's' : ''}.`)
      })
      .catch(() => {
        showToast('Export failed. Please try again.')
      })
  }

  function openOfferModal(c: any) {
    setOfferTarget(c)
    const recommended = OFFER_CATALOG.find((o) => (o.recommendedFor as readonly string[]).includes(c.churnStatus))
    setSelectedOfferId(recommended?.id ?? OFFER_CATALOG[0].id)
    setCustomOfferText('')
  }

  function closeOfferModal() {
    setOfferTarget(null)
    setSelectedOfferId('')
    setCustomOfferText('')
  }

  function confirmGiveOffer() {
    if (!offerTarget) return
    const chosen = OFFER_CATALOG.find((o) => o.id === selectedOfferId)
    const offerText =
      selectedOfferId === 'custom' ? customOfferText.trim() : chosen?.label ?? 'Promotional Offer'

    if (selectedOfferId === 'custom' && offerText === '') {
      showToast('Please write the custom offer text first.')
      return
    }

    setOffersSent((prev) => ({ ...prev, [offerTarget.customerId]: offerText }))
    showToast(`"${offerText}" sent to ${offerTarget.name}.`)
    closeOfferModal()
  }

  return (
    <div className="space-y-6 p-8">
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Comprehensive operational metrics, automated churn forecasting, and system audit logging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.label} value={r.value}>
                Filter Time-Range: {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Download size={15} /> Export Reports
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <SummaryCard label="Revenue Summaries" value={currency(1444900)} sub="Total Monthly Intake" trend="+12.4%" />
          <SummaryCard label="Service Statistics" value="150 Jobs Done" sub="Average 20.4 services daily" trend="+8.4%" />
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Business Performance Trend
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-2xl font-bold text-slate-900">Optimal</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Stable
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">98.2% operational safety rate</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue & Job Trends</p>
              <p className="text-2xl font-bold text-slate-900">{currency(1444900)}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-900" /> Revenue (₱)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Services Done
              </span>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} barGap={4}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="jobsCompleted" fill="#10b981" radius={[4, 4, 0, 0]} name="Services Done" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-400 pl-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Churning</h3>
            <p className="text-sm text-slate-400">Identifies customers at risk of discontinuing services</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search box */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search name / ID / contact"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 text-xs text-slate-600 outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} ({counts[f.value] ?? 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <th className="py-3 font-semibold">Customer ID</th>
              <th className="py-3 font-semibold">Name</th>
              <th className="py-3 font-semibold">Contact</th>
              <th className="py-3 font-semibold">Status (Churn)</th>
              <th className="py-3 font-semibold">Vehicle (Year & Model)</th>
              <th className="py-3 font-semibold">Mileage</th>
              <th className="py-3 font-semibold">Last Checkup</th>
              <th className="py-3 font-semibold">Promotional Offer</th>
              <th className="py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((c: any) => {
              const sentOffer = offersSent[c.customerId]
              const sent = Boolean(sentOffer)
              return (
                <tr key={c.customerId} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 font-semibold text-slate-800">{c.customerId}</td>
                  <td className="py-4 text-slate-700">{c.name}</td>
                  <td className="py-4 text-slate-500">{c.contact}</td>
                  <td className="py-4">
                    <StatusBadge status={c.churnStatus} />
                  </td>
                  <td className="py-4 text-slate-600">{c.vehicle}</td>
                  <td className="py-4 text-slate-600">{c.mileage}</td>
                  <td className="py-4 text-slate-600">{c.lastCheckup ?? '—'}</td>
                  <td className="py-4">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Info size={13} className="text-slate-300" />
                      {sentOffer ?? c.offer ?? (c.churnStatus === 'New Customer' ? 'Welcome Discount' : '—')}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => !sent && openOfferModal(c)}
                      disabled={sent}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        sent
                          ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {sent ? (
                        <>
                          <Check size={13} /> Offer Sent
                        </>
                      ) : (
                        <>
                          <Gift size={13} /> Give Offer
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}

            {filteredList.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-slate-400">
                  No customers match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {offerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Give Offer To</p>
                <h3 className="text-lg font-bold text-slate-900">{offerTarget.name}</h3>
                <p className="text-sm text-slate-500">
                  {offerTarget.vehicle} · {offerTarget.customerId}
                </p>
              </div>
              <StatusBadge status={offerTarget.churnStatus} />
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Choose an offer</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {OFFER_CATALOG.map((offer) => {
                  const isRecommended = (offer.recommendedFor as readonly string[]).includes(
                    offerTarget.churnStatus
                  )
                  const isSelected = selectedOfferId === offer.id
                  return (
                    <label
                      key={offer.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                        isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer"
                        value={offer.id}
                        checked={isSelected}
                        onChange={() => setSelectedOfferId(offer.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{offer.label}</p>
                          {isRecommended && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{offer.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {selectedOfferId === 'custom' && (
                <textarea
                  value={customOfferText}
                  onChange={(e) => setCustomOfferText(e.target.value)}
                  placeholder="e.g. 20% off next brake service, valid until end of month"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeOfferModal}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmGiveOffer}
                className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Gift size={15} /> Send Offer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string
  value: string
  sub: string
  trend: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          {trend}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{sub}</p>
    </div>
  )
}
