'use client'

// Admin "Quotation" page (one step of the job-order workflow: Inspection -> Quotation -> Service Progress). Lets the mechanic/admin build a service+parts quote for the customer to approve, then hands off to Service Progress.
import { useEffect, useMemo, useState, useRef } from 'react'
import Link from "next/link";
import { Plus, Pencil, Check, Send, ShieldCheck, ChevronRight, X, Trash2, RotateCcw } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { JobOrderBreadcrumb } from '../components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { getQuotationById } from '@/controllers/quotationController'
import { getLatestPreDiagnostic, sendForApproval, recallApproval } from '@/controllers/preDiagnosticController'
import { currency } from '../data/mockData'
import { QuotationService, JobOrderCard, QuotationData } from '../data/types'

interface Props {
  jobOrderId: string
}

export function Quotation({ jobOrderId }: Props) {
  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)

  // Quotation data now comes from the real database, which is an async call
  // — loaded via useEffect/state, same as jobOrder, instead of being read
  // synchronously at render time.
  const [initial, setInitial] = useState<QuotationData | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    getJobOrderById(jobOrderId).then((data) => {
      if (active) setJobOrder(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  useEffect(() => {
    let active = true
    getQuotationById(jobOrderId).then((data) => {
      if (active) setInitial(data ?? null)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [services, setServices] = useState<QuotationService[]>([])
  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)

  // Real "send for approval" round — replaces the old local `sent` flag.
  const [preDiagnostic, setPreDiagnostic] = useState<any>(undefined)
  const [sending, setSending] = useState(false)
  const [recalling, setRecalling] = useState(false)

  useEffect(() => {
    let active = true
    getLatestPreDiagnostic(jobOrderId).then((data) => {
      if (active) setPreDiagnostic(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  // Once the real data arrives, seed the editable state from it.
  const hasSeeded = useRef(false)
  useEffect(() => {
    if (initial && !hasSeeded.current) {
      hasSeeded.current = true
      setServices(initial.services)
      setNotes(initial.notes)
    }
  }, [initial])

  // Auto-save logic — only fires after the initial DB data has been seeded,
  // and skips the very first change triggered by seeding itself.
  const isFirstRender = useRef(true)
  // AI predictions for each service
  const [aiPredictions, setAiPredictions] = useState<Record<string, { predicted_amount: number; predicted_duration_mins?: number; is_mock?: boolean }>>({})

  useEffect(() => {
    // Don't auto-save until initial data has loaded and seeded
    if (!hasSeeded.current) return
    
    // Skip the first execution which is triggered by the initial setServices/setNotes
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    
    const timer = setTimeout(() => {
      const servicesWithEstimates = services.map(s => {
        const prediction = aiPredictions[s.id]
        return {
          ...s,
          estimated_amount: prediction?.predicted_amount || s.estimated_amount || s.laborCost,
          actual_amount: s.laborCost
        }
      })

      fetch(`/api/job-orders/${jobOrderId}/quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, services: servicesWithEstimates }),
      }).catch(console.error)
    }, 1000)
    return () => clearTimeout(timer)
  }, [notes, services, aiPredictions, jobOrderId])

  const totals = useMemo(() => {
    let laborTotal = 0
    let partsTotal = 0
    for (const s of services) {
      laborTotal += s.laborCost
      for (const p of s.parts) partsTotal += p.qty * p.unitPrice
    }
    return { laborTotal, partsTotal, grandTotal: laborTotal + partsTotal }
  }, [services])


  useEffect(() => {
    if (!jobOrder || services.length === 0) return
    
    // Parse vehicle info from jobOrder.vehicle (e.g., "2023 Honda CR-V")
    const match = jobOrder.vehicle.match(/^(\d{4})\s+(.+)$/)
    const vehicleYear = match ? parseInt(match[1]) : new Date().getFullYear()
    const vehicleAge = Math.max(0, new Date().getFullYear() - vehicleYear)
    const vehicleType = match ? match[2] : jobOrder.vehicle

    // Fetch AI cost predictions for each service
    services.forEach(async (s) => {
      // Skip AI estimation for custom services since they lack historical store data
      if (!s.dbServiceId) return
      
      // If we already have an estimated amount stored, use it and skip AI call
      if (s.estimated_amount !== undefined && s.estimated_amount !== null && s.estimated_amount > 0) {
        setAiPredictions(prev => ({ ...prev, [s.id]: { predicted_amount: s.estimated_amount!, predicted_duration_mins: (s.estimated_hours || 0) * 60 } }))
        return
      }
      
      const dbService = availableServices.find(as => as.id === s.dbServiceId)
      const basePrice = dbService ? Number(dbService.base_price) : (s.laborCost || 0)
      const baseDurationHours = dbService ? Number(dbService.base_duration_hours) : (s.laborHours || 1)

      try {
        const res = await fetch('/api/predict/cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // For Time Model
            estimated_duration_mins: (s.laborHours || 1) * 60,
            actual_amount: s.laborCost || 0,
            service_id: s.dbServiceId || 0,
            // Shared
            base_price: basePrice,
            base_duration_hours: baseDurationHours,
            is_price_fixed: 0,
            vehicle_age: vehicleAge,
            vehicle_type: vehicleType,
          }),
        })
        const data = await res.json()
        if (data.predicted_amount) {
          setAiPredictions(prev => ({ ...prev, [s.id]: data }))
        }
      } catch {}
    })
  }, [jobOrder, services.length])

  const partsStatusCount = useMemo(() => {
    let inStock = 0
    let toOrder = 0
    for (const s of services)
      for (const p of s.parts) (p.status === 'in-stock' ? inStock++ : toOrder++)
    return { inStock, toOrder }
  }, [services])

  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [customServiceName, setCustomServiceName] = useState('')
  const [isAddingService, setIsAddingService] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/services')
      .then(res => res.json())
      .then(data => {
        if (active && data.success) {
          setAvailableServices(data.services)
        }
      })
      .catch(console.error)
    return () => { active = false }
  }, [])

  if (jobOrder === undefined || initial === undefined || preDiagnostic === undefined) {
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

  function updateLaborHours(serviceId: string, laborHours: number) {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, laborHours } : s)))
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

  // Sends the full quotation (services + parts + total) for approval — a
  // real, persisted database write (creates a new pre_diagnostics round).
  async function sendQuotationForApproval() {
    setSending(true)

    // First save the quotation services and notes
    try {
      const servicesWithEstimates = services.map(s => {
        const prediction = aiPredictions[s.id]
        return {
          ...s,
          estimated_amount: prediction?.predicted_amount || s.estimated_amount || s.laborCost,
          actual_amount: s.laborCost // Admin's quoted actual_amount becomes the actual quoted actual_amount
        }
      })

      const estimated_grand_total = servicesWithEstimates.reduce((sum, s) => sum + Number(s.estimated_amount), 0) + totals.partsTotal
      const actual_grand_total = totals.grandTotal

      await fetch(`/api/job-orders/${jobOrderId}/quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, services: servicesWithEstimates, estimated_grand_total, actual_grand_total }),
      })
    } catch (e) {
      console.error('Failed to save quotation', e)
    }

    const summary = `Quotation total: ${currency(totals.grandTotal)} (Labor: ${currency(totals.laborTotal)}, Parts: ${currency(totals.partsTotal)}). ${notes}`
    const round = await sendForApproval(jobOrderId, summary)
    if (round) setPreDiagnostic(round)
    setSending(false)
  }

  // Recalls a pending approval so the admin can make changes.
  async function handleRecallApproval() {
    setRecalling(true)
    const ok = await recallApproval(jobOrderId)
    if (ok) setPreDiagnostic(null)
    setRecalling(false)
  }


  function openAddServiceModal() {
    setShowServiceModal(true)
    setSelectedServiceId('')
    setCustomServiceName('')
  }

  function removeService(serviceId: string) {
    setServices((prev) => prev.filter((s) => s.id !== serviceId))
  }

  async function confirmAddService() {
    let name = ''
    let laborHours = 1
    let laborCost = 0

    if (selectedServiceId === 'custom') {
      name = customServiceName.trim()
      if (!name) return
    } else if (selectedServiceId) {
      const srv = availableServices.find((s) => String(s.id) === selectedServiceId)
      if (srv) {
        name = srv.service_name
        laborHours = Number(srv.base_duration_hours) || 1
        laborCost = Number(srv.base_price) || 0
      } else {
        return
      }
    } else {
      return
    }

    const newService: QuotationService = {
      id: `SVC-${services.length + 1}`,
      code: `SVC-${String(services.length + 1).padStart(3, '0')}`,
      name,
      description: 'Describe the service...',
      laborHours,
      laborCost,
      parts: [],
      dbServiceId: selectedServiceId === 'custom' ? undefined : Number(selectedServiceId)
    }
    setServices((prev) => [...prev, newService])
    setShowServiceModal(false)
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
            onClick={openAddServiceModal}
            disabled={preDiagnostic?.status === 'pending' || preDiagnostic?.status === 'approved'}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Add Service
          </button>
          {preDiagnostic?.status === 'pending' ? (
            <button
              onClick={handleRecallApproval}
              disabled={recalling}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              <RotateCcw size={14} /> {recalling ? 'Recalling…' : 'Recall Approval'}
            </button>
          ) : (
            <button
              onClick={sendQuotationForApproval}
              disabled={sending || preDiagnostic?.status === 'approved'}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              <Send size={14} />{' '}
              {sending
                ? 'Sending…'
                : preDiagnostic?.status === 'approved'
                ? 'Approved by customer'
                : 'Send to Customer'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Services & Required Parts</h2>
            <span className="text-sm text-slate-400">{services.length} services added</span>
          </div>

          {services.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              No services or parts logged yet for this job order.
            </div>
          )}

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
                      <p className="flex items-center gap-1.5 text-slate-400">
                        Labor Time
                        {!s.dbServiceId ? (
                          <span className="inline-flex cursor-help items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200" title="Need more historical data for AI estimation">
                            🤖 Low Data
                          </span>
                        ) : aiPredictions[s.id] && aiPredictions[s.id].predicted_duration_mins && (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-200"
                            title={`${aiPredictions[s.id].is_mock ? 'ai' : 'AI'} suggests ${Math.round(aiPredictions[s.id].predicted_duration_mins! / 60 * 10) / 10} hrs`}
                          >
                            🤖 {Math.round(aiPredictions[s.id].predicted_duration_mins! / 60 * 10) / 10} hrs
                          </span>
                        )}
                      </p>
                      {editing ? (
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={s.laborHours}
                          onBlur={(e) => {
                            updateLaborHours(s.id, Number(e.target.value) || 0)
                          }}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      ) : (
                        <p className="font-semibold text-slate-800">{s.laborHours} hrs</p>
                      )}
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 text-slate-400">
                        Labor Cost
                        {!s.dbServiceId ? (
                          <span className="inline-flex cursor-help items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200" title="Need more historical data for AI estimation">
                            🤖 Low Data
                          </span>
                        ) : aiPredictions[s.id] && (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-200"
                            title={`${aiPredictions[s.id].is_mock ? 'ai' : 'AI'} suggests ${currency(aiPredictions[s.id].predicted_amount)}`}
                          >
                            🤖 {currency(aiPredictions[s.id].predicted_amount)}
                          </span>
                        )}
                      </p>
                      {editing ? (
                        <input
                          type="number"
                          defaultValue={s.laborCost}
                          onBlur={(e) => {
                            updateLaborCost(s.id, Number(e.target.value) || 0)
                          }}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      ) : (
                        <p className="font-semibold text-slate-800">{currency(s.laborCost)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingServiceId(editing ? null : s.id)}
                        disabled={preDiagnostic?.status === 'pending' || preDiagnostic?.status === 'approved'}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editing ? <Check size={13} /> : <Pencil size={13} />} {editing ? 'Done' : 'Edit'}
                      </button>
                      <button
                        onClick={() => removeService(s.id)}
                        disabled={preDiagnostic?.status === 'pending' || preDiagnostic?.status === 'approved'}
                        className="flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove Service"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span>Required Parts</span>
                  <button 
                    onClick={() => addPart(s.id)} 
                    disabled={preDiagnostic?.status === 'pending' || preDiagnostic?.status === 'approved'}
                    className="flex items-center gap-1 text-emerald-600 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                  >
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
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{notes || 'No notes yet.'}</p>
            )}
            <button
              onClick={() => setEditingNotes((v) => !v)}
              className="mt-2 text-sm font-semibold text-emerald-600 hover:underline"
            >
              {editingNotes ? 'Save Notes' : 'Edit Notes'}
            </button>
          </div>


          {preDiagnostic?.status === 'approved' && (
            <Link
              href={`/job-orders/${jobOrderId}/progress`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue to Service Progress <ChevronRight size={15} />
            </Link>
          )}
        </div>
      </div>

      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowServiceModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add Service</h3>
              <button onClick={() => setShowServiceModal(false)} className="rounded-full p-1 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Service</label>
                <select 
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value="" disabled>Select a service from database...</option>
                  {availableServices.length > 0 ? (
                    availableServices.map(s => (
                      <option key={s.id} value={s.id}>{s.service_name}</option>
                    ))
                  ) : (
                    <option value="" disabled>No services available</option>
                  )}
                  <option value="custom">+ Custom Service (Not Listed)</option>
                </select>
              </div>

              {selectedServiceId === 'custom' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Custom Service Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={customServiceName}
                    onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="e.g. Special Engine Detail"
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowServiceModal(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmAddService} disabled={!selectedServiceId || (selectedServiceId === 'custom' && !customServiceName.trim())} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}