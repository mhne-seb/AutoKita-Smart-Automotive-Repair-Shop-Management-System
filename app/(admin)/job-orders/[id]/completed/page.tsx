'use client'

// Admin "Completed" page — the job order's closing summary once the vehicle
// has been released: what was done, what it cost, how it was paid, the road
// test, and the milestones. This is also where the Job Order document is
// generated (Generate Job Order / Download PDF). Read-only.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Wrench, Package, ShieldCheck, Banknote, Gauge, Clock, FileText, Download, Loader2, ArrowLeft, Car } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { GenerateJobOrderModal } from '@/components/dashboard/GenerateJobOrderModal'
import { Lightbox } from '@/components/Lightbox'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { getBillingData, type BillingData } from '@/controllers/billingStageController'
import { getRoadTestData, type RoadTestData } from '@/controllers/roadTestController'
import { fetchJobOrderPdfData, generateJobOrderPdf } from '@/lib/jobOrderPdf'
import type { JobOrderCard } from '@/data/types'

const currency = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export default function CompletedPage() {
  const params = useParams()
  const jobOrderId = String(params.id)

  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [roadTest, setRoadTest] = useState<RoadTestData | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [photo, setPhoto] = useState<{ url: string; label: string } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getJobOrderById(jobOrderId), getBillingData(jobOrderId), getRoadTestData(jobOrderId)]).then(([jo, b, rt]) => {
      if (!active) return
      setJobOrder(jo); setBilling(b); setRoadTest(rt)
    })
    return () => { active = false }
  }, [jobOrderId])

  async function downloadPdf() {
    setDownloading(true)
    try {
      const d = await fetchJobOrderPdfData(jobOrderId)
      if (!d) return toast.error('Could not build the job order PDF.')
      await generateJobOrderPdf(d)
    } finally {
      setDownloading(false)
    }
  }

  if (jobOrder === undefined || !billing) return <div className="p-8 text-sm text-slate-400">Loading…</div>
  if (!jobOrder) return <div className="p-8 text-sm text-slate-400">Job order not found.</div>

  const released = billing.status === 'released'
  const { bill } = billing
  const laborTotal = billing.services.reduce((t, s) => t + s.amount, 0)
  const partsTotal = billing.parts.reduce((t, p) => t + p.amount, 0)
  const verified = billing.payments.filter((p) => p.verification_status === 'verified')
  const passedTest = roadTest?.history.find((a) => a.result === 'pass') ?? null

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
      <TopBar title="Completed" subtitle="Closing summary of the job order." showSearch={false} />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="completed" stage={jobOrder.stage} />

      {/* Header */}
      <div className={`rounded-2xl border p-6 ${released ? 'border-slate-900 bg-slate-900 text-white' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={`flex items-center gap-2 text-xl font-bold ${released ? '' : 'text-amber-900'}`}>
              {released ? <><CheckCircle2 size={22} className="text-emerald-400" /> Job order completed and released</> : <><Clock size={22} /> Not released yet</>}
            </p>
            <p className={`mt-1 text-sm ${released ? 'text-slate-300' : 'text-amber-800'}`}>
              {released
                ? `${jobOrder.vehicle} (${jobOrder.plate}) · ${billing.customer.name} · released ${fmt(billing.releasedAt)}`
                : 'The summary fills in as the job closes. Release the vehicle from the Billing page once the balance is settled.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowGenerate(true)} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${released ? 'bg-white text-slate-900 hover:bg-slate-100' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <FileText size={14} /> Generate Job Order
            </button>
            <button onClick={downloadPdf} disabled={downloading} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${released ? 'border border-slate-600 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Services + parts */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Wrench size={13} /> Work performed</p>
            <table className="w-full text-sm">
              <tbody>
                {billing.services.map((s, i) => (
                  <tr key={`s-${i}`} className="border-t border-slate-100">
                    <td className="py-2 pr-2"><span className="flex items-center gap-2"><Wrench size={13} className="text-slate-400" /> {s.name}{s.addedMidService && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Added mid-service</span>}</span></td>
                    <td className="py-2 text-right tabular-nums">{currency(s.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold"><td className="py-2">Labor</td><td className="py-2 text-right tabular-nums">{currency(laborTotal)}</td></tr>
              </tbody>
            </table>
            <p className="mb-3 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Package size={13} /> Parts</p>
            <table className="w-full text-sm">
              <tbody>
                {billing.parts.map((p, i) => (
                  <tr key={`p-${i}`} className="border-t border-slate-100">
                    <td className="py-2 pr-2"><span className="flex items-center gap-2"><Package size={13} className="text-slate-400" /> {p.name} <span className="text-xs text-slate-400">· {p.partNo || '—'} · ×{p.qty}</span>{p.warranty && <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><ShieldCheck size={10} /> Warranty</span>}</span></td>
                    <td className="py-2 text-right tabular-nums">{currency(p.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold"><td className="py-2">Parts</td><td className="py-2 text-right tabular-nums">{currency(partsTotal)}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Road test */}
          {roadTest && roadTest.history.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Gauge size={13} /> Road test</p>
              <ul className="space-y-2">
                {roadTest.history.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">Attempt {a.attemptNo} <span className="font-normal text-slate-400">· {a.testerName} · {fmt(a.startedAt)}</span></p>
                      {a.notes && <p className="text-xs text-slate-500">{a.notes}</p>}
                      {a.result === 'fail' && a.reworkTaskTitles.length > 0 && <p className="text-xs text-slate-500">Sent back: {a.reworkTaskTitles.join(', ')}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {a.photoUrl && <button type="button" onClick={() => setPhoto({ url: a.photoUrl!, label: `Road test attempt ${a.attemptNo}` })}><img src={a.photoUrl} alt="" className="h-9 w-12 rounded border object-cover" /></button>}
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.result === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{a.result === 'pass' ? 'Passed' : 'Failed'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Money */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Banknote size={13} /> Payment</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-semibold text-slate-800">{currency(bill.total)}</span></div>
              {verified.map((p) => (
                <div key={p.id} className="flex justify-between text-xs text-slate-500"><span>{p.payment_channel || p.payment_method.replace('_', ' ')} · {fmt(p.payment_date)}</span><span>− {currency(p.amount_paid)}</span></div>
              ))}
              <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-700">Balance</span><span className={`text-lg font-bold ${bill.balance <= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{currency(bill.balance)}</span></div>
            </div>
            {!released && <Link href={`/job-orders/${jobOrderId}/billing`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline"><ArrowLeft size={12} /> Billing</Link>}
          </div>

          {/* Milestones */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Clock size={13} /> Milestones</p>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-3"><span className="text-slate-500">Road test passed</span><span className="text-slate-800">{fmt(passedTest?.endedAt ?? null)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-slate-500">Completed</span><span className="text-slate-800">{fmt(billing.completedAt)}</span></li>
              <li className="flex justify-between gap-3"><span className="text-slate-500">Released</span><span className={released ? 'font-semibold text-emerald-600' : 'text-slate-800'}>{fmt(billing.releasedAt)}</span></li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Car size={13} /> Vehicle</p>
            <p className="font-semibold text-slate-800">{jobOrder.vehicle}</p>
            <p className="text-xs text-slate-500">{jobOrder.plate} · {billing.customer.name}{billing.customer.phone ? ` · ${billing.customer.phone}` : ''}</p>
          </div>
        </div>
      </div>

      {showGenerate && <GenerateJobOrderModal jobOrderId={jobOrderId} onClose={() => setShowGenerate(false)} />}
      {photo && <Lightbox url={photo.url} label={photo.label} onClose={() => setPhoto(null)} />}
    </div>
  )
}
