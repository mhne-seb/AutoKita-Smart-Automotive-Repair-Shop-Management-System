'use client'

// Admin "Billing" page — after the road test passes. The final bill
// (services + parts − verified payments), every payment the customer sent
// with its proof, Verify / Reject, a counter-cash entry, and the hand-over.
// Numbers come from lib/jobOrderBill, the same source as the customer's
// Completed page, so both screens always agree.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Check, XCircle, Banknote, Car, Loader2, ArrowLeft, Wrench, Package, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { verifyJobOrderPayment } from '@/controllers/quotationController'
import { getBillingData, releaseVehicle, type BillingData, type BillingPayment } from '@/controllers/billingStageController'
import type { JobOrderCard } from '@/data/types'

const currency = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

const STATUS_PILL: Record<BillingPayment['verification_status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  verified: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  refunded: 'bg-slate-100 text-slate-600',
}

export default function BillingPage() {
  const params = useParams()
  const router = useRouter()
  const jobOrderId = String(params.id)

  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)
  const [data, setData] = useState<BillingData | null>(null)
  const [proof, setProof] = useState<string | null>(null)
  const [busyPaymentId, setBusyPaymentId] = useState<number | null>(null)
  const [releasing, setReleasing] = useState(false)
  const [confirmRelease, setConfirmRelease] = useState(false)
  // Warranty is entered once, at release, and can't be edited afterward —
  // bulkMonths is the default applied to every part; a part in this map
  // overrides that default (e.g. a battery carrying a longer term).
  const [bulkMonths, setBulkMonths] = useState(6)
  const [warrantyOverrides, setWarrantyOverrides] = useState<Record<number, number>>({})

  async function load() {
    const [jo, b] = await Promise.all([getJobOrderById(jobOrderId), getBillingData(jobOrderId)])
    setJobOrder(jo)
    setData(b)
  }
  useEffect(() => { load() }, [jobOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Payments the customer submits (and anything else that changes the bill)
  // show up on their own until the vehicle has actually gone home.
  const awaiting = Boolean(data) && data!.status !== 'released'
  useEffect(() => {
    if (!awaiting) return
    const t = setInterval(() => { load() }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaiting])

  async function decide(p: BillingPayment, decision: 'verified' | 'rejected') {
    setBusyPaymentId(p.id)
    const ok = await verifyJobOrderPayment(jobOrderId, p.id, decision)
    setBusyPaymentId(null)
    if (!ok) return toast.error('Could not update the payment.')
    const cash = p.payment_method === 'cash'
    toast.success(
      decision === 'verified'
        ? cash ? 'Cash received — recorded and the customer has been notified.' : 'Payment verified — the customer has been notified.'
        : cash ? 'Noted — the customer can choose another way to pay.' : 'Payment rejected — the customer will be asked to resubmit.',
    )
    await load()
  }


  async function onRelease() {
    setReleasing(true)
    const warrantyByPart = Object.fromEntries(
      (data?.parts ?? []).map((p) => [p.id, warrantyOverrides[p.id] ?? bulkMonths]),
    )
    const r = await releaseVehicle(jobOrderId, warrantyByPart)
    setReleasing(false)
    setConfirmRelease(false)
    if (!r.ok) {
      // The server checks the live balance; refresh so the screen matches it.
      toast.error(`${r.message} — refreshing the bill.`)
      await load()
      return
    }
    toast.success('Vehicle released — the customer has been notified.')
    router.push(`/job-orders/${jobOrderId}/completed`)
  }

  if (jobOrder === undefined || !data) return <div className="p-8 text-sm text-slate-400">Loading…</div>
  if (!jobOrder) return <div className="p-8 text-sm text-slate-400">Job order not found.</div>

  const { bill } = data
  const released = data.status === 'released'
  const paidInFull = bill.balance <= 0
  // A pending cash row is "I'll pay at the counter" — nothing to verify, just
  // confirm once the money is in hand. Only pending transfers need checking.
  const pendingTransfers = data.payments.filter((p) => p.verification_status === 'pending' && p.payment_method !== 'cash').length
  const pendingCash = data.payments.filter((p) => p.verification_status === 'pending' && p.payment_method === 'cash').length
  const notYetDone = data.status !== 'completed' && !released

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
      <TopBar title="Billing" subtitle="Final bill, payment verification, and vehicle release." showSearch={false} />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="billing" stage={jobOrder.stage} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 sm:gap-6">
          <div><p className="text-slate-400">Vehicle</p><p className="font-bold text-slate-900">{jobOrder.vehicle}</p></div>
          <div><p className="text-slate-400">Plate No.</p><p className="font-bold text-slate-900">{jobOrder.plate}</p></div>
          <div><p className="text-slate-400">Customer</p><p className="font-bold text-slate-900">{data.customer.name}</p>{data.customer.phone && <p className="text-xs text-slate-400">{data.customer.phone}</p>}</div>
          <div className="sm:text-right"><p className="text-slate-400">Job Order</p><span className="inline-block rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">JO-{jobOrderId}</span></div>
        </div>
      </div>

      {notYetDone && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle size={16} /> The job isn't complete yet — the balance becomes collectable once the road test passes.
          <Link href={`/job-orders/${jobOrderId}/testing`} className="ml-auto font-semibold underline">Go to Testing</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---- Payments ---- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Banknote size={13} /> Payments</p>
              <span className="flex gap-2">
                {pendingTransfers > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{pendingTransfers} to verify</span>}
                {pendingCash > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">{pendingCash} paying at counter</span>}
              </span>
            </div>
            {data.payments.length === 0 ? (
              <p className="text-sm text-slate-400">No payments yet. The customer chooses how to pay from their Billing page — a transfer to verify, or cash to confirm at the counter.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.payments.map((p) => {
                  const busy = busyPaymentId === p.id
                  const cashIntent = p.payment_method === 'cash' && p.verification_status === 'pending'
                  return (
                    <li key={p.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                      {p.proof_of_payment_image ? (
                        <button type="button" onClick={() => setProof(p.proof_of_payment_image)} className="shrink-0 self-start overflow-hidden rounded-md border">
                          <img src={p.proof_of_payment_image} alt="" className="h-14 w-20 object-cover" />
                        </button>
                      ) : (
                        <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400"><Banknote size={18} /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{currency(p.amount_paid)} <span className="font-normal text-slate-500">· {cashIntent ? 'will pay at the counter' : p.payment_channel || p.payment_method.replace('_', ' ')}</span></p>
                        <p className="text-xs text-slate-400">{cashIntent ? `Chose cash on ${fmt(p.payment_date)} — nothing received yet` : `${fmt(p.payment_date)}${p.reference_number ? ` · Ref ${p.reference_number}` : ''}`}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cashIntent ? 'bg-sky-100 text-sky-700' : STATUS_PILL[p.verification_status]}`}>{cashIntent ? 'Awaiting cash' : p.verification_status}</span>
                      {p.verification_status === 'pending' && (
                        <div className="flex shrink-0 gap-2">
                          <button onClick={() => decide(p, 'rejected')} disabled={busy} className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"><XCircle size={13} /> {cashIntent ? "Didn't pay" : 'Reject'}</button>
                          <button onClick={() => decide(p, 'verified')} disabled={busy} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {cashIntent ? 'Cash received' : 'Verify'}</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ---- Line items ---- */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Receipt size={13} /> Final bill</p>
            <table className="w-full text-sm">
              <tbody>
                {data.services.map((s, i) => (
                  <tr key={`s-${i}`} className="border-t border-slate-100">
                    <td className="py-2 pr-2"><span className="flex items-center gap-2"><Wrench size={13} className="text-slate-400" /> {s.name}{s.addedMidService && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Added mid-service</span>}</span></td>
                    <td className="py-2 text-right tabular-nums">{currency(s.amount)}</td>
                  </tr>
                ))}
                {data.parts.map((p, i) => (
                  <tr key={`p-${i}`} className="border-t border-slate-100">
                    <td className="py-2 pr-2"><span className="flex items-center gap-2"><Package size={13} className="text-slate-400" /> {p.name} <span className="text-xs text-slate-400">· {p.partNo || '—'} · ×{p.qty} @ {currency(p.unitPrice)}</span>{p.warranty && <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><ShieldCheck size={10} /> Warranty</span>}</span></td>
                    <td className="py-2 text-right tabular-nums">{currency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---- Sidebar: totals, cash, release ---- */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Receipt size={13} /> Balance</p>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${released ? 'bg-slate-900 text-white' : paidInFull ? 'bg-emerald-100 text-emerald-700' : bill.paid > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {released ? 'Released' : paidInFull ? 'Paid in full' : bill.paid > 0 ? 'Partially paid' : 'Unpaid'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-semibold text-slate-800">{currency(bill.total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Paid (verified)</span><span className="font-semibold text-slate-800">− {currency(bill.paid)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-700">Balance</span><span className={`text-xl font-bold ${paidInFull ? 'text-emerald-600' : 'text-slate-900'}`}>{currency(bill.balance)}</span></div>
            </div>
          </div>


          <div className={`rounded-2xl border p-5 ${released ? 'border-slate-900 bg-slate-900 text-white' : paidInFull ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
            <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${released ? 'text-slate-300' : 'text-slate-400'}`}><Car size={13} /> Vehicle release</p>
            {released ? (
              <>
                <p className="mt-2 flex items-center gap-2 text-lg font-bold"><CheckCircle2 size={20} className="text-emerald-400" /> Released</p>
                <p className="mt-1 text-sm text-slate-300">{fmt(data.releasedAt)}</p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  {paidInFull ? 'Balance settled. Hand the keys over and mark it released.' : `Release unlocks once the balance is ₱0 (${currency(bill.balance)} still due).`}
                </p>
                {confirmRelease ? (
                  <div className="mt-3 space-y-3">
                    {data.parts.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-600">Apply warranty to all parts</label>
                            <select
                              value={bulkMonths}
                              onChange={(e) => setBulkMonths(Number(e.target.value))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                            >
                              <option value={3}>3 months</option>
                              <option value={6}>6 months</option>
                              <option value={12}>12 months</option>
                            </select>
                          </div>
                          <button
                            onClick={() => setWarrantyOverrides({})}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Apply
                          </button>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {data.parts.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-slate-600">{p.name}</span>
                              <select
                                value={warrantyOverrides[p.id] ?? bulkMonths}
                                onChange={(e) => setWarrantyOverrides((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                              >
                                <option value={3}>3 months</option>
                                <option value={6}>6 months</option>
                                <option value={12}>12 months</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">Locked once released — each part keeps its own term.</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={onRelease} disabled={releasing} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{releasing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Yes, released</button>
                      <button onClick={() => setConfirmRelease(false)} disabled={releasing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRelease(true)} disabled={!paidInFull || notYetDone} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"><Car size={14} /> Release vehicle</button>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
            <p className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-400"><Clock size={13} /> Timeline</p>
            <p className="mt-2">Completed: <span className="text-slate-700">{fmt(data.completedAt)}</span></p>
            <p className="mt-1">Released: <span className="text-slate-700">{fmt(data.releasedAt)}</span></p>
            <Link href={`/job-orders/${jobOrderId}/progress`} className="mt-3 inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 hover:underline"><ArrowLeft size={12} /> Service Progress</Link>
          </div>
        </div>
      </div>

      {proof && <Lightbox url={proof} label="Proof of payment" onClose={() => setProof(null)} />}
    </div>
  )
}
