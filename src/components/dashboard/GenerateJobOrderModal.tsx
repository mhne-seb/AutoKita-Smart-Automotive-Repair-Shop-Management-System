'use client'

// GenerateJobOrderModal — a read-only preview of the Job Order, laid out like
// the shop's paper form (letterhead; name / date / address / date promised /
// phone / plate / year & model; parts left, work right; totals; partial
// payments; balance). Everything comes from the database via
// /api/job-orders/[id]/document — nothing here is editable, so the printed
// sheet always matches the record. Download as PDF.

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { SHOP_PROFILE } from '@/data/shopProfile'
import { generateJobOrderPdf, type JobOrderPdfData } from '@/lib/jobOrderPdf'

interface Props {
  jobOrderId: string
  onClose: () => void
}

const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase() : ''

export function GenerateJobOrderModal({ jobOrderId, onClose }: Props) {
  const [data, setData] = useState<JobOrderPdfData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/job-orders/${jobOrderId}/document`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (!d.success) { setError(d.message ?? 'Could not load the job order.'); return }
        setData({
          jobOrderId: d.jobOrderId,
          date: d.date,
          datePromised: d.datePromised,
          customer: d.customer,
          vehicle: d.vehicle,
          parts: d.parts,
          services: d.services,
          payments: d.payments.map((p: { amount: number; label: string }) => ({ label: `PARTIAL PAYMENT ${p.label}`.trim(), amount: p.amount })),
        })
      })
      .catch(() => active && setError('Could not load the job order.'))
    return () => { active = false }
  }, [jobOrderId])

  const totals = useMemo(() => {
    if (!data) return null
    const parts = data.parts.reduce((t, p) => t + p.qty * p.unitPrice, 0)
    const service = data.services.reduce((t, s) => t + s.amount, 0)
    const paid = data.payments.reduce((t, p) => t + p.amount, 0)
    return { parts, service, grand: parts + service, paid, balance: parts + service - paid }
  }, [data])

  async function downloadPdf() {
    if (!data) return
    setDownloading(true)
    try { await generateJobOrderPdf(data) } finally { setDownloading(false) }
  }

  const cell = 'border border-slate-400 px-2 py-1.5 align-top'
  const head = 'border border-slate-400 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-700'
  const rowCount = data ? Math.max(data.parts.length, data.services.length, 8) : 0 // paper form has room for blank lines

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">

      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <div>
            <p className="font-bold text-slate-900">Job Order · JO-{jobOrderId}</p>
            <p className="text-xs text-slate-400">Generated from the quotation and payments on record.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadPdf} disabled={!data || downloading} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
            </button>
            <button onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={16} /></button>
          </div>
        </div>

        {error ? (
          <div className="p-16 text-center text-sm text-rose-600">{error}</div>
        ) : !data || !totals ? (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading job order…</div>
        ) : (
          <div className="overflow-y-auto bg-slate-100 p-4 sm:p-6">
            <div className="jo-sheet mx-auto w-full max-w-[210mm] bg-white p-8 text-slate-900 shadow-md">
              {/* Letterhead */}
              <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <img src={SHOP_PROFILE.logo} alt="" className="h-14 w-14 object-contain" />
                  <div className="text-[12px] leading-snug">
                    <p className="text-[14px] font-bold">{SHOP_PROFILE.name}</p>
                    <p>{SHOP_PROFILE.address}</p>
                    <p>{SHOP_PROFILE.phones.join(' / ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black tracking-tight">JOB ORDER</h1>
                  <p className="mt-0.5 inline-block rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">No. JO-{jobOrderId}</p>
                </div>
              </div>

              {/* Customer / vehicle block — same six fields, same order as the paper form */}
              <div className="mt-4 grid grid-cols-2 border border-slate-400 text-[13px]">
                {([
                  ['Name', data.customer.name], ['Date', fmtDate(data.date)],
                  ['Address', data.customer.address], ['Date Promised', fmtDate(data.datePromised)],
                  ['Phone', data.customer.phone], ['Plate No.', data.vehicle.plate],
                ] as [string, string][]).map(([label, value], i) => (
                  <div key={label} className={`flex gap-2 border-slate-400 px-2 py-1.5 ${i % 2 === 0 ? 'border-r' : ''} ${i < 4 ? 'border-b' : ''}`}>
                    <span className="w-28 shrink-0 font-semibold text-slate-600">{label}:</span>
                    <span>{value}</span>
                  </div>
                ))}
                <div className="col-span-2 flex gap-2 border-t border-slate-400 px-2 py-1.5">
                  <span className="w-28 shrink-0 font-semibold text-slate-600">Year &amp; Model:</span>
                  <span>{data.vehicle.yearModel}</span>
                </div>
              </div>

              {/* Parts | Work */}
              <table className="mt-4 w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={`${head} w-12`}>Qty</th>
                    <th className={head}>Parts No. and Description</th>
                    <th className={`${head} w-20 text-right`}>Unit Price</th>
                    <th className={`${head} w-24 text-right`}>Amount</th>
                    <th className={head}>Description of Work</th>
                    <th className={`${head} w-24 text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, i) => {
                    const p = data.parts[i]
                    const s = data.services[i]
                    return (
                      <tr key={i}>
                        <td className={`${cell} text-center`}>{p ? p.qty : ''}</td>
                        <td className={cell}>{p?.description ?? ''}</td>
                        <td className={`${cell} text-right tabular-nums`}>{p ? peso(p.unitPrice) : ''}</td>
                        <td className={`${cell} text-right tabular-nums`}>{p ? peso(p.qty * p.unitPrice) : ''}</td>
                        <td className={cell}>{s?.description ?? ''}</td>
                        <td className={`${cell} text-right tabular-nums`}>{s ? peso(s.amount) : ''}</td>
                      </tr>
                    )
                  })}
                  <tr className="font-bold">
                    <td colSpan={3} className={`${cell} bg-slate-50`}>TOTAL PARTS</td>
                    <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(totals.parts)}</td>
                    <td className={`${cell} bg-slate-50`}>TOTAL SERVICE</td>
                    <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(totals.service)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Totals + signatures */}
              <div className="mt-4 flex flex-col items-start justify-between gap-6 sm:flex-row">
                <div className="text-[12px]">
                  <p className="mb-8 text-slate-500">Received the vehicle and agreed to the above:</p>
                  <div className="w-56 border-t border-slate-900 pt-1">Customer signature over printed name</div>
                  <div className="mt-8 w-56 border-t border-slate-900 pt-1">Prepared by</div>
                </div>
                <table className="w-full max-w-[320px] border-collapse text-[13px]">
                  <tbody>
                    <tr className="font-bold">
                      <td className={cell}>GRAND TOTAL</td>
                      <td className={`${cell} text-right tabular-nums`}>{peso(totals.grand)}</td>
                    </tr>
                    {data.payments.map((p, i) => (
                      <tr key={i}>
                        <td className={cell}>{p.label}</td>
                        <td className={`${cell} text-right tabular-nums`}>({peso(p.amount)})</td>
                      </tr>
                    ))}
                    <tr className="text-[15px] font-black">
                      <td className={`${cell} bg-slate-50`}>BALANCE</td>
                      <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(totals.balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-6 text-[10px] text-slate-400">Generated by AutoKita · {new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
