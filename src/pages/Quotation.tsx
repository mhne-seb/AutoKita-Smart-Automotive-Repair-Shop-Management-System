'use client'

// Admin "Quotation" page (one step of the job-order workflow: Inspection -> Quotation -> Service Progress). Lets the mechanic/admin build a service+parts quote for the customer to approve, then hands off to Service Progress.
import { useEffect, useMemo, useState } from 'react'
import Link from "next/link";
import { Plus, Pencil, Check, Send, ShieldCheck, ChevronRight } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { JobOrderBreadcrumb } from '../components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById } from '@/controllers/quotationController'
import { currency } from '../data/mockData'
import { QuotationService, JobOrderCard } from '../data/types'

interface Props {
  jobOrderId: string
}

export function Quotation({ jobOrderId }: Props) {
  // Loaded through the controller (mock API) — see jobOrderController.ts.
  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)
  const initial = getQuotationById(jobOrderId)

  useEffect(() => {
    let active = true
    getJobOrderById(jobOrderId).then((data) => {
      if (active) setJobOrder(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [services, setServices] = useState<QuotationService[]>(initial?.services ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [sent, setSent] = useState(initial?.sentToCustomer ?? false)

  const totals = useMemo(() => {
    let laborTotal = 0
    let partsTotal = 0
    for (const s of services) {
      laborTotal += s.laborCost
      for (const p of s.parts) partsTotal += p.qty * p.unitPrice
    }
    return { laborTotal, partsTotal, grandTotal: laborTotal + partsTotal }
  }, [services])

  const partsStatusCount = useMemo(() => {
    let inStock = 0
    let toOrder = 0
    for (const s of services)
      for (const p of s.parts) (p.status === 'in-stock' ? inStock++ : toOrder++)
    return { inStock, toOrder }
  }, [services])

  if (jobOrder === undefined) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Loading quotation…</p>
      </div>
    )
  }

  if (!jobOrder || !initial) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Job order not found.</p>
      </div>
    )
  }

  function updateLaborCost(serviceId: string, laborCost: number) {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, laborCost } : s)))
  }

  function addPart(serviceId: string) {
    const name = window.prompt('Part name?')
    if (!name) return
    const unitPrice = Number(window.prompt('Unit price (₱)?', '0')) || 0
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              parts: [
                ...s.parts,
                { id: `${serviceId}-p${s.parts.length + 1}`, name, partNo: `PRT-${Math.floor(Math.random() * 9000 + 1000)}`, qty: 1, unitPrice, status: 'to-order' },
              ],
            }
          : s
      )
    )
  }

  function addService() {
    const name = window.prompt('New service name?')
    if (!name) return
    const newService: QuotationService = {
      id: `SVC-${services.length + 1}`,
      code: `SVC-${String(services.length + 1).padStart(3, '0')}`,
      name,
      description: 'Describe the service...',
      laborHours: 1,
      laborCost: 0,
      parts: [],
    }
    setServices((prev) => [...prev, newService])
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="quotation" />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-4 gap-6 text-sm">
          <div>
            <p className="text-slate-400">Vehicle</p>
            <p className="font-bold text-slate-900">{jobOrder.vehicle}</p>
          </div>
          <div>
            <p className="text-slate-400">Plate No.</p>
            <p className="font-bold text-slate-900">{jobOrder.plate}</p>
          </div>
          <div>
            <p className="text-slate-400">Customer</p>
            <p className="font-bold text-slate-900">{jobOrder.customer}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Job Order</p>
            <span className="inline-block rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
              JO-{jobOrderId.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
            <ShieldCheck size={13} /> Admin — Quotation Preparation
          </span>
          <span className="text-sm text-slate-400">Add and review services before sending to customer</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={addService}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} /> Add Service
          </button>
          {/* "Generate Job Order" moved to the shared JobOrderBreadcrumb so it's
              visible on Inspection, Quotation, and Progress alike. */}
          <button
            onClick={() => setSent(true)}
            disabled={sent}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            <Send size={14} /> {sent ? 'Sent to Customer' : 'Send to Customer'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Services & Required Parts</h2>
            <span className="text-sm text-slate-400">{services.length} services added</span>
          </div>

          {services.map((s) => {
            const partsSubtotal = s.parts.reduce((sum, p) => sum + p.qty * p.unitPrice, 0)
            const inStock = s.parts.filter((p) => p.status === 'in-stock').length
            const editing = editingServiceId === s.id
            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">🔧</div>
                    <div>
                      <p className="text-xs text-slate-400">{s.code}</p>
                      <p className="font-bold text-slate-900">{s.name}</p>
                      <p className="text-sm text-slate-500">{s.description}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-6 text-sm">
                    <div>
                      <p className="text-slate-400">Labor Time</p>
                      <p className="font-semibold text-slate-800">{s.laborHours} hrs</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Labor Cost</p>
                      {editing ? (
                        <input
                          type="number"
                          autoFocus
                          defaultValue={s.laborCost}
                          onBlur={(e) => {
                            updateLaborCost(s.id, Number(e.target.value) || 0)
                            setEditingServiceId(null)
                          }}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      ) : (
                        <p className="font-semibold text-slate-800">{currency(s.laborCost)}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingServiceId(editing ? null : s.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {editing ? <Check size={13} /> : <Pencil size={13} />} {editing ? 'Done' : 'Edit'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span>Required Parts</span>
                  <button onClick={() => addPart(s.id)} className="flex items-center gap-1 text-emerald-600 hover:underline">
                    <Plus size={12} /> Add Part
                  </button>
                </div>

                <div className="mt-2 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Part Name</th>
                        <th className="px-3 py-2 text-left font-medium">Qty</th>
                        <th className="px-3 py-2 text-left font-medium">Unit Price</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.parts.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.partNo}</p>
                          </td>
                          <td className="px-3 py-2">×{p.qty}</td>
                          <td className="px-3 py-2">{currency(p.unitPrice)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                p.status === 'in-stock' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {p.status === 'in-stock' ? 'In Stock' : 'To Order'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {s.parts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-400">
                            No parts added yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 flex items-center justify-between bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-500">
                    {inStock} parts in stock · <span className="text-amber-600">{s.parts.length - inStock} parts to order</span>
                  </span>
                  <span className="font-semibold text-slate-700">Parts Subtotal: {currency(partsSubtotal)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-900 p-5 text-white">
            <p className="mb-3 font-bold">📄 Quotation Summary</p>
            <div className="space-y-2 text-sm text-slate-300">
              {services.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name}</span>
                  <span>{currency(s.laborCost + s.parts.reduce((sum, p) => sum + p.qty * p.unitPrice, 0))}</span>
                </div>
              ))}
            </div>
            <div className="my-3 border-t border-white/10" />
            <div className="space-y-1 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Total Labor</span>
                <span>{currency(totals.laborTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Parts</span>
                <span>{currency(totals.partsTotal)}</span>
              </div>
            </div>
            <div className="my-3 border-t border-white/10" />
            <div className="flex justify-between text-base font-bold">
              <span>Grand Total</span>
              <span>{currency(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 font-bold text-slate-900">Parts Status</p>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500" /> In Stock</span>
              <span className="font-semibold text-slate-800">{partsStatusCount.inStock} parts</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-500"><span className="h-2 w-2 rounded-full bg-amber-500" /> To Order</span>
              <span className="font-semibold text-slate-800">{partsStatusCount.toOrder} parts</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-2 font-bold text-slate-900">📝 Inspection Notes</p>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-slate-400 focus:outline-none"
              />
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{notes}</p>
            )}
            <button
              onClick={() => setEditingNotes((v) => !v)}
              className="mt-2 text-sm font-semibold text-emerald-600 hover:underline"
            >
              {editingNotes ? 'Save Notes' : 'Edit Notes'}
            </button>
          </div>

          <Link
            href={`/job-orders/${jobOrderId}/progress`}
            onClick={() => void advanceJobOrderStage(jobOrderId, 'in-progress')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Continue to Service Progress <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}