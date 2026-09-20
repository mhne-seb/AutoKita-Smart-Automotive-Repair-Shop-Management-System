'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Info, Lock, Search, Check, X, Eye, Phone, Wallet, Wrench, CreditCard, Users, History, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import type { Mechanic, PaymentRecord, WeeklyService } from '@/data/mockData'
import { currency } from '@/data/mockData'
const autokitaLogo = '/assets/autokita-logo.png' // static asset path (was a bundler import)

const TABS = [
  { key: 'payments', label: 'Customer Payment Records', icon: CreditCard },
  { key: 'payroll', label: 'Employee Payroll & Commission', icon: Users },
  { key: 'services', label: 'Weekly Services & Commission', icon: Wrench },
] as const

type TabKey = (typeof TABS)[number]['key']

// Generic CSV download helper — builds a CSV from an array of row objects
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const csvContent = [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper: compute subtotal from itemized breakdown
function getSubtotal(p: PaymentRecord) {
  if (!p.items || p.items.length === 0) return p.amount
  return p.items.reduce((sum, it) => sum + it.qty * it.price, 0)
}

// Builds and downloads a formal, letterhead-style printable invoice (opens print dialog in a new window)
function downloadInvoice(p: PaymentRecord) {
  const subtotal = getSubtotal(p)
  const isDownpayment = p.paymentType === 'Downpayment'
  const parts = p.items?.filter((it) => it.category === 'Parts') ?? []
  const labor = p.items?.filter((it) => it.category === 'Labor') ?? []

  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })

  const rowHtml = (it: { name: string; qty: number; price: number }) => `
    <tr>
      <td style="padding:7px 0; color:#1e293b;">${it.name}</td>
      <td style="padding:7px 0; text-align:center; color:#64748b;">x${it.qty}</td>
      <td style="padding:7px 0; text-align:right; color:#64748b;">${currency(it.price)}</td>
      <td style="padding:7px 0; text-align:right; font-weight:600; color:#0f172a;">${currency(it.qty * it.price)}</td>
    </tr>`

  const sectionHtml = (title: string, rows: { name: string; qty: number; price: number }[]) => {
    if (rows.length === 0) return ''
    const sectionTotal = rows.reduce((s, it) => s + it.qty * it.price, 0)
    return `
      <tr>
        <td colspan="3" style="padding-top:16px; padding-bottom:4px; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#0f172a; font-weight:800; border-bottom:1px solid #e2e8f0;">${title}</td>
        <td style="padding-top:16px; padding-bottom:4px; text-align:right; font-size:11px; color:#0f172a; font-weight:800; border-bottom:1px solid #e2e8f0;">${currency(sectionTotal)}</td>
      </tr>
      ${rows.map(rowHtml).join('')}
    `
  }

  const html = `
    <html>
      <head>
        <title>Invoice - ${p.customerId}</title>
        <style>
          @page { margin: 24px; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            padding: 36px;
            max-width: 620px;
            margin: 0 auto;
          }
          .letterhead {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 3px solid #0f172a;
          }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 52px; height: 52px; object-fit: contain; }
          .brand-name { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; }
          .brand-tagline { font-size: 11px; color: #64748b; margin-top: 1px; }
          .brand-meta { font-size: 10.5px; color: #94a3b8; margin-top: 6px; line-height: 1.5; }
          .invoice-title { text-align: right; }
          .invoice-title h1 {
            font-size: 20px;
            margin: 0;
            letter-spacing: 0.04em;
            color: #0f172a;
          }
          .invoice-title .booking { font-size: 12px; color: #64748b; margin-top: 4px; }
          .badge { display:inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
          .paid { background:#d1fae5; color:#059669; }
          .down { background:#fef3c7; color:#b45309; }

          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px 24px;
            margin-top: 20px;
            padding: 14px 16px;
            background: #f8fafc;
            border-radius: 10px;
            font-size: 12.5px;
          }
          .info-grid .label { color: #94a3b8; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.04em; }
          .info-grid .value { color: #1e293b; font-weight: 600; margin-bottom: 8px; }

          table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 13px; }
          .totals { margin-top: 4px; border-top: 1px solid #e2e8f0; }
          .totals td { padding: 7px 0; }
          .totals .label { color: #64748b; }
          .grand { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 800; }

          .footer {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid #e2e8f0;
            font-size: 10.5px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div class="brand">
            <img src="${autokitaLogo}" alt="AutoKita" />
            <div>
              <div class="brand-name">AutoKita Auto Service Center</div>
              <div class="brand-tagline">Trusted Vehicle Care, Every Mile</div>
              <div class="brand-meta">
                123 Aurora Blvd, Brgy. San Isidro, Quezon City, Metro Manila, Philippines 1113<br />
                Tel: +63 2 8123 4567 &nbsp;•&nbsp; support@autokita.ph<br />
                TIN: 123-456-789-000
              </div>
            </div>
          </div>
          <div class="invoice-title">
            <h1>SERVICE INVOICE</h1>
            <div class="booking">Booking ID: ${p.customerId}</div>
            <div class="booking">Date: ${today}</div>
            <span class="badge ${isDownpayment ? 'down' : 'paid'}">${isDownpayment ? 'Downpayment' : 'Paid'}</span>
          </div>
        </div>

        <div class="info-grid">
          <div>
            <div class="label">Customer</div>
            <div class="value">${p.name}</div>
          </div>
          <div>
            <div class="label">Contact No.</div>
            <div class="value">${p.contact}</div>
          </div>
          <div>
            <div class="label">Service</div>
            <div class="value">${p.services}</div>
          </div>
          <div>
            <div class="label">Mode of Payment</div>
            <div class="value">${p.modeOfPayment}</div>
          </div>
        </div>

        <table>
          ${sectionHtml('Parts', parts)}
          ${sectionHtml('Labor', labor)}
        </table>

        <table class="totals">
          <tr><td class="label">Subtotal:</td><td style="text-align:right;">${currency(subtotal)}</td></tr>
          ${
            isDownpayment
              ? `<tr><td class="label">Downpayment received:</td><td style="text-align:right; color:#059669;">- ${currency(p.downpaymentAmount ?? 0)}</td></tr>
                 <tr class="grand"><td>Balance Due:</td><td style="text-align:right;">${currency(subtotal - (p.downpaymentAmount ?? 0))}</td></tr>`
              : `<tr class="grand"><td>Total Paid:</td><td style="text-align:right; color:#059669;">${currency(subtotal)}</td></tr>`
          }
        </table>

        <div class="footer">
          Thank you for choosing AutoKita.<br />
          This invoice was generated electronically and is valid without a signature.
        </div>
      </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

interface SalesPayrollAuditLog {
  id: number
  adminId: number
  adminName: string
  actionPerformed: string
  entityType: string
  entityId: number
  oldValues: string | null
  newValues: string | null
  actionDate: string
}

export default function page() {
  const [activeTab, setActiveTab] = useState<TabKey>('payments')

  // Live state from Supabase
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [auditLogs, setAuditLogs] = useState<SalesPayrollAuditLog[]>([])

  const [kpi, setKpi] = useState({
    weeklyGrossSales: 0,
    prevWeeklyGrossSales: 0,
    salesGrowthPct: '0.0',
    totalCommissions: 0,
    netProfit: 0,
    activeMechanicsCount: 0,
  })

  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([])
  const [weeklyServices, setWeeklyServices] = useState<WeeklyService[]>([])

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/admin/sales-payroll')
      const data = await res.json()
      if (data.success) {
        setPaymentRecords(data.paymentRecords || [])
        setMechanics(data.mechanics || [])
        setWeeklyServices(data.weeklyServices || [])
        if (data.kpi) setKpi(data.kpi)
        if (data.auditLogs) setAuditLogs(data.auditLogs)
      } else {
        console.error('Failed to load sales and payroll data:', data.message)
      }
    } catch (err) {
      console.error('Failed to connect to sales-payroll API:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const [editingField, setEditingField] = useState<{ id: string; field: 'rank' | 'commission' } | null>(null)
  const [draftValue, setDraftValue] = useState('')

  const startEdit = (id: string, field: 'rank' | 'commission', currentValue: string | number) => {
    setEditingField({ id, field })
    setDraftValue(String(currentValue))
  }

  const cancelEdit = () => {
    setEditingField(null)
    setDraftValue('')
  }

  const saveEdit = async () => {
    if (!editingField) return
    const target = mechanics.find((m) => m.id === editingField.id)
    if (!target) return

    const rawVal = draftValue
    const val = editingField.field === 'commission' ? Math.max(0, Math.min(100, Number(rawVal) || 0)) : rawVal

    // Optimistically update the UI
    setMechanics((prev) =>
      prev.map((m) => {
        if (m.id !== editingField.id) return m
        if (editingField.field === 'rank') {
          return { ...m, rank: String(val) }
        }
        return { ...m, commissionPercent: Number(val) }
      })
    )
    const editingCopy = { ...editingField }
    setEditingField(null)
    setDraftValue('')
    setSavingId(target.id)

    try {
      const adminId = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null
      const res = await fetch('/api/admin/sales-payroll', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: target.id,
          field: editingCopy.field,
          value: val,
          adminId,
        }),
      })
      const result = await res.json()
      if (result.success) {
        setToast(`Updated ${target.name}'s ${editingCopy.field} and logged to audit trail!`)
        setTimeout(() => setToast(null), 4000)
        // Refresh audit logs in background
        fetch('/api/admin/sales-payroll')
          .then((r) => r.json())
          .then((d) => d.success && setAuditLogs(d.auditLogs || []))
      } else {
        alert(result.message || 'Failed to update database.')
        loadData()
      }
    } catch (err) {
      console.error('Error saving payroll edit:', err)
      alert('Network error when updating database.')
      loadData()
    } finally {
      setSavingId(null)
    }
  }

  const weeklyGrossSales = kpi.weeklyGrossSales
  const netProfit = kpi.netProfit
  const totalCommissionsFlat = useMemo(() => {
    if (kpi.totalCommissions > 0) return kpi.totalCommissions
    return mechanics.reduce(
      (sum, m) => sum + Math.round((weeklyGrossSales / (mechanics.length || 1)) * (m.commissionPercent / 100)),
      0,
    )
  }, [kpi.totalCommissions, weeklyGrossSales, mechanics])

  // ---------- Customer Payment Records: search + status filter ----------
  const [paymentSearch, setPaymentSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'To Be Paid'>('All')
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null)

  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase()
    return paymentRecords.filter((p) => {
      const matchesSearch =
        !q ||
        p.customerId.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.contact.toLowerCase().includes(q) ||
        p.services.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [paymentSearch, statusFilter])

  const exportPayments = () => {
    downloadCsv(
      'customer-payment-records.csv',
      ['Customer ID', 'Name', 'Contact No.', 'Services', 'Mode of Payment', 'Payment Type', 'Amount', 'Status'],
      filteredPayments.map((p) => [p.customerId, p.name, p.contact, p.services, p.modeOfPayment, p.paymentType, p.amount, p.status]),
    )
  }

  // ---------- Employee Payroll: search + rank filter ----------
  const [payrollSearch, setPayrollSearch] = useState('')

  const filteredMechanics = useMemo(() => {
    const q = payrollSearch.trim().toLowerCase()
    if (!q) return mechanics
    return mechanics.filter(
      (m) => m.name.toLowerCase().includes(q) || m.phone.toLowerCase().includes(q) || String(m.rank).toLowerCase().includes(q),
    )
  }, [payrollSearch, mechanics])

  const exportPayroll = () => {
    downloadCsv(
      'employee-payroll-commission.csv',
      ['Employee Name', 'Contact', 'Rank', 'Base Salary', 'Commission %', 'Commission Salary', 'Services Done (Weekly)'],
      filteredMechanics.map((m) => [
        m.name,
        m.phone,
        m.rank,
        m.baseSalary,
        `${m.commissionPercent}%`,
        Math.round((weeklyGrossSales / mechanics.length) * (m.commissionPercent / 100)),
        m.servicesDoneWeekly,
      ]),
    )
  }

  // ---------- Weekly Services: search ----------
  const [servicesSearch, setServicesSearch] = useState('')

  const filteredServices = useMemo(() => {
    const q = servicesSearch.trim().toLowerCase()
    if (!q) return weeklyServices
    return weeklyServices.filter((s) => s.name.toLowerCase().includes(q))
  }, [servicesSearch])

  const exportServices = () => {
    downloadCsv(
      'weekly-services-commission.csv',
      ['Service', 'Qty', 'Price', 'Allocated Commission'],
      filteredServices.map((s) => [s.name, s.qty, s.price, s.allocatedCommission]),
    )
  }

  return (
    <div className="space-y-6 p-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Sales & Payroll</h1>
          <p className="mt-1 text-sm text-slate-500">
            Weekly automated payroll summaries, employee commissions, and business sales reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <History size={16} className="text-blue-600" />
            Audit Trail
            {auditLogs.length > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {auditLogs.length}
              </span>
            )}
          </button>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
            title="Refresh live data from Supabase"
          >
            <RefreshCw size={15} className={`text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <select className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 outline-none">
            <option>Payroll Cycle: Weekly</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin text-blue-600" />
            Loading live sales & payroll records from Supabase...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SummaryCard 
            label="Weekly Gross Sales" 
            value={currency(weeklyGrossSales)} 
            sub={`${kpi.salesGrowthPct.startsWith('-') ? '' : '+'}${kpi.salesGrowthPct}% vs last period`} 
            positive={!kpi.salesGrowthPct.startsWith('-')} 
          />
          <SummaryCard
            label="Total Commissions Allocated"
            value={currency(totalCommissionsFlat)}
            sub={`Automated split across ${mechanics.length} active workers`}
          />
          <SummaryCard 
            label="Net Financial Profit" 
            value={currency(netProfit)} 
            sub="After employee salaries & commissions" 
          />
        </div>
      )}

      {/* Clickable tab navigation, pill style */}
      <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 p-1.5 text-sm w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'payments' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
          <div className="p-6">
          <div className="flex items-center justify-between border-l-4 border-slate-900 pl-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Customer Payment Records
            </h3>
            <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
              <Info size={13} /> To Be Paid entries require action
            </span>
          </div>

          {/* Search + filter toolbar */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="Search by customer, ID, contact, or service..."
                className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 outline-none focus:border-slate-400"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="To Be Paid">To Be Paid</option>
            </select>
            <button
              onClick={exportPayments}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3 font-semibold">Customer ID</th>
                <th className="py-3 font-semibold">Name</th>
                <th className="py-3 font-semibold">Contact No.</th>
                <th className="py-3 font-semibold">Services</th>
                <th className="py-3 font-semibold">Mode of Payment</th>
                <th className="py-3 font-semibold">Payment Type</th>
                <th className="py-3 font-semibold">Amount</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((p) => (
                <tr
                  key={p.customerId}
                  onClick={() => setSelectedPayment(p)}
                  className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50"
                >
                  <td className="py-4 font-semibold text-slate-800">{p.customerId}</td>
                  <td className="py-4 text-slate-700">{p.name}</td>
                  <td className="py-4 text-slate-500">{p.contact}</td>
                  <td className="py-4 text-slate-600">{p.services}</td>
                  <td className="py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {p.modeOfPayment}
                    </span>
                  </td>
                  <td className="py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        p.paymentType === 'Full Payment'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.paymentType}
                    </span>
                  </td>
                  <td className="py-4 font-semibold text-slate-800">{currency(p.amount)}</td>
                  <td className="py-4">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPayment(p)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-sm text-slate-400">
                    No matching payment records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <p>* Highlighted rows indicate pending customer payments that require collection or follow-up.</p>
            <p>{filteredPayments.length} of {paymentRecords.length} records shown</p>
          </div>
          </div>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
          <div className="p-6">
          <div className="flex items-center justify-between border-l-4 border-slate-900 pl-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Employee Payroll & Commission Summary
            </h3>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
              <Info size={13} /> Rank & Commission % are manually editable
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={payrollSearch}
                onChange={(e) => setPayrollSearch(e.target.value)}
                placeholder="Search by employee name, contact, or rank..."
                className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <button
              onClick={exportPayroll}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3 font-semibold">Employee Name</th>
                <th className="py-3 font-semibold">Contact</th>
                <th className="py-3 font-semibold">Rank Number (Editable)</th>
                <th className="py-3 font-semibold">Base Salary</th>
                <th className="py-3 font-semibold">Commission % (Editable)</th>
                <th className="py-3 font-semibold">Commission Salary (Automated Split)</th>
                <th className="py-3 font-semibold">Services Done (Weekly)</th>
              </tr>
            </thead>
            <tbody>
              {filteredMechanics.map((m) => {
                const commissionSalary = Math.round((weeklyGrossSales / mechanics.length) * (m.commissionPercent / 100))
                const isEditingRank = editingField?.id === m.id && editingField.field === 'rank'
                const isEditingCommission = editingField?.id === m.id && editingField.field === 'commission'
                return (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-4 font-semibold text-slate-800">{m.name}</td>
                    <td className="py-4 text-slate-500">{m.phone}</td>
                    <td className="py-4">
                      {isEditingRank ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-500"
                          />
                          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700">
                            <Check size={16} />
                          </button>
                          <button onClick={cancelEdit} className="text-rose-500 hover:text-rose-600">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(m.id, 'rank', m.rank)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
                        >
                          {m.rank}
                          <Pencil size={12} className="text-slate-400" />
                        </button>
                      )}
                    </td>
                    <td className="py-4 text-slate-700">{currency(m.baseSalary)}</td>
                    <td className="py-4">
                      {isEditingCommission ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            max={100}
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit()
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-500"
                          />
                          <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700">
                            <Check size={16} />
                          </button>
                          <button onClick={cancelEdit} className="text-rose-500 hover:text-rose-600">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(m.id, 'commission', m.commissionPercent)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400"
                        >
                          {m.commissionPercent}%
                          <Pencil size={12} className="text-slate-400" />
                        </button>
                      )}
                    </td>
                    <td className="py-4 font-bold text-blue-600">{currency(commissionSalary)}</td>
                    <td className="py-4 text-slate-700">{m.servicesDoneWeekly} Completed</td>
                  </tr>
                )
              })}
              {filteredMechanics.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    No matching employees.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <ul className="mt-4 space-y-1 text-xs text-slate-400">
            <li>• Commission Salary is computed automatically as all services divided equally among the active mechanics/workers.</li>
            <li>• Newly added mechanics from the Employee Tab are automatically cascaded here with a default rank, salary, and commission percentage.</li>
          </ul>
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
          <div className="p-6">
          <div className="flex items-center justify-between border-l-4 border-emerald-500 pl-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              Weekly Services Completed & Commission Breakdown
            </h3>
            <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              <Lock size={12} /> Recorded and Paid Services (Locked)
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={servicesSearch}
                onChange={(e) => setServicesSearch(e.target.value)}
                placeholder="Search by service name..."
                className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <button
              onClick={exportServices}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3 font-semibold">Services</th>
                <th className="py-3 font-semibold">Qty</th>
                <th className="py-3 font-semibold">Price (cannot be edited)</th>
                <th className="py-3 font-semibold">Allocated Commission</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((s) => (
                <tr key={s.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 font-semibold text-slate-800">{s.name}</td>
                  <td className="py-4 text-slate-600">{s.qty}</td>
                  <td className="py-4 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      {currency(s.price)}
                      <Lock size={11} className="text-slate-300" />
                    </span>
                  </td>
                  <td className="py-4 font-bold text-emerald-600">{currency(s.allocatedCommission)}</td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-slate-400">
                    No matching services.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Payment details modal */}
      {selectedPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedPayment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Record</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedPayment.name}</h3>
                <p className="text-sm text-slate-400">{selectedPayment.customerId}</p>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-3">
                <Phone size={16} className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Contact No.</p>
                  <p className="text-sm text-slate-700">{selectedPayment.contact}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Wallet size={16} className="mt-0.5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Mode of Payment</p>
                  <p className="text-sm text-slate-700">{selectedPayment.modeOfPayment}</p>
                </div>
              </div>

              {/* ---- Itemized services breakdown (Parts / Labor) ---- */}
              <div className="flex items-start gap-3">
                <Wrench size={16} className="mt-0.5 text-slate-400 shrink-0" />
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-slate-400">Services Breakdown</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        selectedPayment.paymentType === 'Downpayment'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedPayment.paymentType === 'Downpayment' ? 'Downpayment' : 'Paid'}
                    </span>
                  </div>

                  {selectedPayment.items && selectedPayment.items.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-slate-100 p-3">
                      {(['Parts', 'Labor'] as const).map((category) => {
                        const rows = selectedPayment.items!.filter((it) => it.category === category)
                        if (rows.length === 0) return null
                        const sectionTotal = rows.reduce((sum, it) => sum + it.qty * it.price, 0)
                        return (
                          <div key={category} className="mb-3 last:mb-0">
                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-400">
                              <span>{category}</span>
                              <span>{currency(sectionTotal)}</span>
                            </div>
                            {rows.map((it) => (
                              <div key={it.name} className="mt-1.5 flex items-center justify-between text-sm">
                                <span className="text-slate-700">{it.name}</span>
                                <span className="flex items-center gap-3 text-slate-500">
                                  <span>x{it.qty}</span>
                                  <span>{currency(it.price)}</span>
                                  <span className="w-16 text-right font-semibold text-slate-800">
                                    {currency(it.qty * it.price)}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">{selectedPayment.services}</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Payment Type</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                      selectedPayment.paymentType === 'Full Payment'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedPayment.paymentType}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-800">{currency(getSubtotal(selectedPayment))}</span>
                  </div>

                  {selectedPayment.paymentType === 'Downpayment' ? (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Downpayment received</span>
                        <span className="font-semibold text-emerald-600">
                          - {currency(selectedPayment.downpaymentAmount ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                        <span className="font-bold text-slate-900">Balance Due</span>
                        <span className="text-xl font-bold text-slate-900">
                          {currency(getSubtotal(selectedPayment) - (selectedPayment.downpaymentAmount ?? 0))}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                      <span className="font-bold text-slate-900">Total Paid</span>
                      <span className="text-xl font-bold text-emerald-600">{currency(getSubtotal(selectedPayment))}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-400">Status</p>
                  <StatusBadge status={selectedPayment.status} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => downloadInvoice(selectedPayment)}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Download size={14} /> Download Invoice
              </button>
              <button
                onClick={() => setSelectedPayment(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowAuditModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Sales & Payroll Audit Trail</h3>
                  <p className="text-xs text-slate-500">
                    Live audit logs recorded in <code className="font-mono text-blue-600">system_audit_logs</code>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  No audit logs recorded for sales and payroll yet. Changes to mechanics or payments will appear here.
                </div>
              ) : (
                auditLogs.map((log) => {
                  let oldVal: Record<string, unknown> = {}
                  let newVal: Record<string, unknown> = {}
                  try {
                    oldVal = log.oldValues ? JSON.parse(log.oldValues) : {}
                    newVal = log.newValues ? JSON.parse(log.newValues) : {}
                  } catch {
                    // ignore JSON parse failure
                  }

                  return (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition-all hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          {log.adminName}
                        </span>
                        <span className="text-slate-400">
                          {new Date(log.actionDate).toLocaleString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-800">
                        Updated <span className="font-semibold text-slate-900">{log.entityType}</span> (Target ID #{log.entityId})
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {Object.keys(newVal).map((key) => (
                          <div key={key} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1">
                            <span className="font-semibold capitalize text-slate-600">{key.replace('_', ' ')}:</span>{' '}
                            <span className="text-rose-500 line-through">{String(oldVal[key] ?? 'N/A')}</span>
                            {' → '}
                            <span className="font-bold text-emerald-600">{String(newVal[key] ?? 'N/A')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Done
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
  positive,
}: {
  label: string
  value: string
  sub: string
  positive?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      <p className={`mt-2 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-slate-400'}`}>{sub}</p>
    </div>
  )
}