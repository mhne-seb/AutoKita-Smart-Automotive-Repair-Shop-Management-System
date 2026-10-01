'use client'

// ServiceHistory — the admin's one place to look back at past work.
// Each row is a booking (ticket) with its job order when it has one. Search,
// status, date range, sorting and paging all happen in the database through
// /api/admin/history, so this works the same with 20 rows or 20,000.

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Eye, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'

type Status = 'pending' | 'in_progress' | 'completed' | 'released' | 'cancelled'
type SortKey = 'date' | 'id' | 'customer' | 'status'

interface Row {
  ticketId: number
  jobOrderId: number | null
  date: string
  status: Status
  customer: string
  email: string | null
  contact: string | null
  vehicle: string
  plate: string
  services: string
  isWarrantyClaim: boolean
  total: number | null
  paid: number | null
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending', in_progress: 'In progress', completed: 'Completed', released: 'Released', cancelled: 'Cancelled',
}
const STATUS_STYLE: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  released: 'bg-slate-800 text-white',
  cancelled: 'bg-rose-100 text-rose-800',
}
const TABS: { key: '' | Status; label: string }[] = [
  { key: '', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' }, { key: 'released', label: 'Released' }, { key: 'cancelled', label: 'Cancelled' },
]

const peso = (n: number | null | undefined) =>
  n == null ? '—' : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A spreadsheet runs text that starts with = + - @ as a formula; neutralise it.
function csvCell(v: unknown) {
  let s = String(v ?? '')
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function ServiceHistory() {
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | Status>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState<SortKey>('date')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)

  const rangeError = from && to && from > to ? 'The start date is after the end date.' : null

  // wait until the admin stops typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [qInput])

  const query = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort, dir })
    if (q) p.set('q', q)
    if (status) p.set('status', status)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    for (const [k, v] of Object.entries(extra)) p.set(k, v)
    return p.toString()
  }

  useEffect(() => {
    if (rangeError) return
    const ctl = new AbortController()
    setLoading(true)
    setError(null)
    fetch(`/api/admin/history?${query()}`, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) throw new Error(j.message || 'Could not load the service history.')
        setRows(j.rows); setCounts(j.counts); setTotal(j.total); setTotalPages(j.totalPages)
        if (j.page > j.totalPages) setPage(j.totalPages)
        setLoading(false)
      })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, status, from, to, sort, dir])

  function onSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSort(key); setDir(key === 'date' ? 'desc' : 'asc') }
    setPage(1)
  }

  function resetAll() {
    setQInput(''); setQ(''); setStatus(''); setFrom(''); setTo(''); setSort('date'); setDir('desc'); setPage(1)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const r = await fetch(`/api/admin/history?${query({ export: '1', page: '1', pageSize: '100' })}`)
      const j = await r.json()
      if (!j.success) throw new Error(j.message)
      const header = ['Booked', 'Ticket', 'Job order', 'Customer', 'Email', 'Contact', 'Vehicle', 'Plate', 'Services', 'Status', 'Total', 'Paid']
      const lines = (j.rows as Row[]).map((x) => [
        fmtDate(x.date), `ST-${x.ticketId}`, x.jobOrderId ? `JO-${x.jobOrderId}` : '', x.customer, x.email ?? '', x.contact ?? '',
        x.vehicle, x.plate, x.services, STATUS_LABEL[x.status], x.total ?? '', x.paid ?? '',
      ].map(csvCell).join(','))
      const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `autokita-service-history-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(`Exported ${j.rows.length} record${j.rows.length === 1 ? '' : 's'}.${j.truncated ? ' Only the first 5,000 were included; narrow the filters.' : ''}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not export.')
    } finally {
      setExporting(false)
    }
  }

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-4 py-3 font-semibold">
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sort === k ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <span className="w-[13px]" />}
      </button>
    </th>
  )

  const from1 = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to1 = Math.min(page * pageSize, total)
  const pageNumbers: number[] = []
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pageNumbers.push(p)
  const filtered = Boolean(q || status || from || to)

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <TopBar title="Service History" subtitle="Every booking and its job order, newest first." showSearch={false} />

      {/* status tabs with counts */}
      <div className="flex w-fit max-w-full items-center gap-2 overflow-x-auto rounded-full border border-border bg-card p-1.5">
        {TABS.map(({ key, label }) => {
          const active = status === key
          const n = key === '' ? counts.all : counts[key]
          return (
            <button
              key={label}
              onClick={() => { setStatus(key); setPage(1) }}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${active ? 'bg-white/20 text-white' : 'bg-accent text-muted-foreground'}`}>
                {n ?? 0}
              </span>
            </button>
          )
        })}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={qInput}
              maxLength={100}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search name, plate, ticket or job order…"
              aria-label="Search service history"
              className="w-64 rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-sm shadow-sm focus:border-brand focus:outline-none sm:w-80"
            />
            {qInput && (
              <button onClick={() => setQInput('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <label className="text-xs font-medium text-muted-foreground">
            From
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} className="ml-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-sm text-foreground shadow-sm" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            To
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} className="ml-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-sm text-foreground shadow-sm" />
          </label>
          {(filtered || sort !== 'date' || dir !== 'desc') && (
            <button onClick={resetAll} className="rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:underline">Reset</button>
          )}
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export
        </button>
      </div>
      {rangeError && <p className="-mt-3 flex items-center gap-1.5 text-xs text-destructive"><AlertCircle size={13} /> {rangeError}</p>}

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <SortHead k="date">Booked</SortHead>
                <SortHead k="id">Record</SortHead>
                <SortHead k="customer">Customer</SortHead>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 font-semibold">Services</th>
                <SortHead k="status">Status</SortHead>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Paid</th>
                <th className="px-4 py-3 text-right font-semibold">View</th>
              </tr>
            </thead>
            <tbody className={loading && rows.length > 0 ? 'opacity-50 transition-opacity' : ''}>
              {error ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-destructive">
                  <AlertCircle className="mx-auto mb-2" size={20} />{error}
                </td></tr>
              ) : loading && rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  {filtered ? 'No records match your search or filters.' : 'No service records yet.'}
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.ticketId} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(r.date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-semibold">ST-{r.ticketId}</div>
                    <div className="text-xs text-muted-foreground">{r.jobOrderId ? `JO-${r.jobOrderId}` : 'No job order'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.customer}</div>
                    <div className="text-xs text-muted-foreground">{r.contact || r.email || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{r.vehicle || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.plate}</div>
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <div className="truncate" title={r.services}>{r.services || '—'}</div>
                    {r.isWarrantyClaim && <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Warranty claim</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{peso(r.total)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{peso(r.paid)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetailId(r.ticketId)} aria-label={`View record ST-${r.ticketId}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* footer: count, rows per page, pages */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>Showing {from1}–{to1} of {total} record{total === 1 ? '' : 's'}</span>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              Rows per page
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-lg border border-border bg-card px-2 py-1 text-foreground">
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page" className="rounded-lg border border-border p-1.5 hover:bg-accent disabled:opacity-40"><ChevronLeft size={15} /></button>
              {pageNumbers.map((n) => (
                <button key={n} onClick={() => setPage(n)} className={`min-w-8 rounded-lg px-2 py-1 text-sm font-semibold ${n === page ? 'bg-brand text-white' : 'hover:bg-accent'}`}>{n}</button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Next page" className="rounded-lg border border-border p-1.5 hover:bg-accent disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>
      </div>

      {detailId !== null && <DetailModal ticketId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One record in full

interface Detail {
  ticket: { id: number; requestDate: string; preferred: string | null; mode: string | null; concern: string | null; status: string; isWarrantyClaim: boolean }
  customer: { name: string; email: string | null; contact: string | null; address: string | null }
  vehicle: { label: string; plate: string; type: string | null; mileage: number | null }
  jobOrder: { id: number; status: string; arrived: string | null; started: string | null; completed: string | null; released: string | null; quotationApproved: boolean | null; mechanic: string | null } | null
  services: { name: string; amount: number; addedMidService: boolean }[]
  parts: { name: string; partNo: string | null; qty: number; amount: number; warrantyMonths: number | null; replacement: boolean }[]
  payments: { method: string; channel: string | null; reference: string | null; amount: number; date: string; status: string }[]
  warranties: { coverage: string; start: string; expires: string; status: string }[]
  bill: { total: number; paid: number; balance: number } | null
  timeline: { action: string; entity: string; date: string; text: string }[]
}

const words = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—')

function DetailModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/admin/history/${ticketId}`)
      .then((r) => r.json())
      .then((j) => { if (!alive) return; if (!j.success) setError(j.message || 'Could not load this record.'); else setD(j) })
      .catch(() => alive && setError('Could not load this record.'))
    return () => { alive = false }
  }, [ticketId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-border p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
  const Line = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-0.5 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value || '—'}</span></div>
  )
  const warrantyText = (m: number | null) => (m == null ? '—' : m === 0 ? 'No warranty' : `${m} month${m === 1 ? '' : 's'}`)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={boxRef} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-background px-6 py-4">
          <div>
            <h2 className="text-lg font-bold">Ticket ST-{ticketId}{d?.jobOrder ? ` · JO-${d.jobOrder.id}` : ''}</h2>
            <p className="text-sm text-muted-foreground">{d ? `Booked ${fmtDate(d.ticket.requestDate)}` : 'Loading…'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-accent"><X size={18} /></button>
        </div>

        {error ? (
          <p className="px-6 py-10 text-center text-destructive">{error}</p>
        ) : !d ? (
          <p className="px-6 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 animate-spin" size={20} />Loading…</p>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Section title="Customer">
                <Line label="Name" value={d.customer.name} />
                <Line label="Email" value={d.customer.email} />
                <Line label="Contact" value={d.customer.contact} />
                <Line label="Address" value={d.customer.address} />
              </Section>
              <Section title="Vehicle">
                <Line label="Vehicle" value={d.vehicle.label} />
                <Line label="Plate" value={d.vehicle.plate} />
                <Line label="Type" value={d.vehicle.type} />
                <Line label="Mileage" value={d.vehicle.mileage != null ? `${d.vehicle.mileage.toLocaleString('en-PH')} km` : null} />
              </Section>
            </div>

            <Section title="Booking">
              <Line label="Ticket status" value={words(d.ticket.status)} />
              <Line label="Service" value={words(d.ticket.mode)} />
              <Line label="Preferred time" value={fmtDateTime(d.ticket.preferred)} />
              {d.ticket.isWarrantyClaim && <Line label="Type" value="Warranty claim" />}
              <p className="mt-1 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">Concern: </span>{d.ticket.concern || '—'}</p>
            </Section>

            {d.jobOrder ? (
              <>
                <Section title="Job order">
                  <Line label="Status" value={words(d.jobOrder.status)} />
                  <Line label="Mechanic" value={d.jobOrder.mechanic} />
                  <Line label="Vehicle arrived" value={fmtDateTime(d.jobOrder.arrived)} />
                  <Line label="Work started" value={fmtDateTime(d.jobOrder.started)} />
                  <Line label="Completed" value={fmtDateTime(d.jobOrder.completed)} />
                  <Line label="Released" value={fmtDateTime(d.jobOrder.released)} />
                  <Line label="Quotation approved" value={d.jobOrder.quotationApproved ? 'Yes' : 'No'} />
                </Section>

                <Section title="Services and parts">
                  {d.services.length === 0 && d.parts.length === 0 ? <p className="text-sm text-muted-foreground">No services or parts recorded.</p> : (
                    <table className="w-full text-sm">
                      <tbody>
                        {d.services.map((s, i) => (
                          <tr key={`s${i}`} className="border-b border-border/50"><td className="py-1.5">{s.name}{s.addedMidService && <span className="ml-1.5 rounded bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-800">added mid-service</span>}</td><td className="py-1.5 text-right">{peso(s.amount)}</td></tr>
                        ))}
                        {d.parts.map((p, i) => (
                          <tr key={`p${i}`} className="border-b border-border/50">
                            <td className="py-1.5 pl-4 text-muted-foreground">{p.qty}× {p.name}{p.replacement ? ' (warranty replacement)' : ''} · warranty: {warrantyText(p.warrantyMonths)}</td>
                            <td className="py-1.5 text-right">{peso(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {d.bill && (
                    <div className="mt-2 space-y-0.5 border-t border-border pt-2">
                      <Line label="Total" value={peso(d.bill.total)} />
                      <Line label="Paid (verified)" value={peso(d.bill.paid)} />
                      <Line label="Balance" value={<b>{peso(d.bill.balance)}</b>} />
                    </div>
                  )}
                </Section>

                <Section title="Payments">
                  {d.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments submitted.</p> : (
                    <table className="w-full text-sm">
                      <tbody>
                        {d.payments.map((p, i) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-1.5">{fmtDate(p.date)}</td>
                            <td className="py-1.5">{p.channel || words(p.method)}{p.reference ? ` · ${p.reference}` : ''}</td>
                            <td className="py-1.5">{words(p.status)}</td>
                            <td className="py-1.5 text-right">{peso(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>

                <Section title="Warranties">
                  {d.warranties.length === 0 ? <p className="text-sm text-muted-foreground">No warranties issued.</p> : d.warranties.map((w, i) => (
                    <Line key={i} label={w.coverage} value={`${words(w.status)} · until ${fmtDate(w.expires)}`} />
                  ))}
                </Section>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">This ticket has no job order (it was declined or is still waiting for approval).</p>
            )}

            <Section title="Timeline">
              {d.timeline.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded.</p> : (
                <ul className="space-y-1 text-sm">
                  {d.timeline.map((t, i) => (
                    <li key={i} className="flex justify-between gap-4"><span>{words(t.action)}{t.text ? ` — ${t.text}` : ''}<span className="text-muted-foreground"> ({words(t.entity)})</span></span><span className="shrink-0 text-muted-foreground">{fmtDateTime(t.date)}</span></li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}
