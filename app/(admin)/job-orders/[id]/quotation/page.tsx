'use client'

// Admin "Quotation" page (one step of the job-order workflow: Inspection -> Quotation -> Service Progress). Lets the mechanic/admin build a service+parts quote for the customer to approve, then hands off to Service Progress.
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useRef } from 'react'
import { Plus, Pencil, Check, Send, ShieldCheck, ChevronRight, X, Trash2, RotateCcw, PackagePlus, CreditCard, XCircle, ClipboardCheck } from 'lucide-react'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById, getJobOrderPayment, verifyJobOrderPayment, type JobOrderPayment } from '@/controllers/quotationController'
import { getLatestPreDiagnostic, sendForApproval, recallApproval } from '@/controllers/preDiagnosticController'
import { getInspectionById } from '@/controllers/inspectionController'
import { currency } from '@/data/mockData'
import { QuotationService, JobOrderCard, QuotationData, MechanicalFinding, findingStatusMeta, QuotationPart } from '@/data/types'

export default function page() {
  const jobOrderId = String(useParams().id)
  const router = useRouter()
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
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedDraft, setSavedDraft] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    let active = true
    getLatestPreDiagnostic(jobOrderId).then((data) => {
      if (active) setPreDiagnostic(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  // The findings the customer approved at the inspection stage — the reason
  // this quotation exists. Read-only here; they're edited on the inspection page.
  const [findings, setFindings] = useState<MechanicalFinding[]>([])
  useEffect(() => {
    let active = true
    getInspectionById(jobOrderId).then((data) => {
      if (active) setFindings(data?.findings ?? [])
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  // The customer's submitted payment (if any) — bank/e-wallet transfers need
  // a human to check the proof against the shop's own account before they
  // count as verified.
  const [payment, setPayment] = useState<JobOrderPayment | null | undefined>(undefined)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [showProofLightbox, setShowProofLightbox] = useState(false)

  useEffect(() => {
    let active = true
    getJobOrderPayment(jobOrderId).then((data) => {
      if (active) setPayment(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  async function handleVerifyPayment(decision: 'verified' | 'rejected') {
    if (!payment) return
    setVerifyingPayment(true)
    const ok = await verifyJobOrderPayment(jobOrderId, payment.id, decision)
    if (ok) setPayment({ ...payment, verificationStatus: decision })
    setVerifyingPayment(false)
  }

  // The handoff to the floor. Normally the stage is already in_progress by the
  // time this is clicked (2FA confirm / payment verify advance it server-side),
  // but if it isn't — e.g. an older job order — this advances it, so the
  // breadcrumb and the customer's tracker agree the work has started.
  const [startingWork, setStartingWork] = useState(false)
  async function continueToServiceProgress() {
    setStartingWork(true)
    if (jobOrder && jobOrder.stage !== 'in-progress' && jobOrder.stage !== 'completed') {
      const updated = await advanceJobOrderStage(jobOrderId, 'in-progress')
      if (updated) setJobOrder(updated)
    }
    router.push(`/job-orders/${jobOrderId}/progress`)
  }

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
    // Once the customer has approved, the page is read-only — there's nothing
    // to save, and a save is a full delete/reinsert of services and parts
    // (which would otherwise fire every visit when the AI predictions land).
    if (initial?.quotationApproved) return
    
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
    
    // Use DB data if available, otherwise parse from string
    const match = !jobOrder.vehicleYear ? jobOrder.vehicle.match(/^(\d{4})\s+(.+)$/) : null
    const vehicleYear = jobOrder.vehicleYear || (match ? parseInt(match[1]) : new Date().getFullYear())
    const vehicleAge = Math.max(0, new Date().getFullYear() - vehicleYear)
    const vehicleType = (match ? match[2] : jobOrder.vehicle) || 'Unknown'
    const actualMileage = jobOrder.mileage || (vehicleAge * 15000)

    // Fetch AI cost predictions for each service
    services.forEach(async (s) => {
      // Skip AI estimation for custom services since they lack historical store data
      if (!s.dbServiceId) return
      
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
            service_id: s.dbServiceId || 0,
            // Shared
            base_price: basePrice,
            base_duration_hours: baseDurationHours,
            is_price_fixed: 0,
            vehicle_age: vehicleAge,
            vehicle_type: vehicleType,
            mileage: actualMileage,
          }),
        })
        const data = await res.json()
        if (data.predicted_amount) {
          setAiPredictions(prev => ({ ...prev, [s.id]: data }))
        } else if (s.estimated_amount && s.estimated_amount > 0) {
          // Fall back to stored value if prediction fails
          setAiPredictions(prev => ({ ...prev, [s.id]: { predicted_amount: s.estimated_amount!, predicted_duration_mins: (s.estimated_hours || 0) * 60 } }))
        }
      } catch {
        // Fall back to stored value on network error
        if (s.estimated_amount && s.estimated_amount > 0) {
          setAiPredictions(prev => ({ ...prev, [s.id]: { predicted_amount: s.estimated_amount!, predicted_duration_mins: (s.estimated_hours || 0) * 60 } }))
        }
      }
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

  // Add Part modal — replaces the old window.prompt() flow.
  const [showPartModal, setShowPartModal] = useState(false)
  const [partModalServiceId, setPartModalServiceId] = useState<string | null>(null)
  const [editingPartId, setEditingPartId] = useState<string | null>(null)
  const [partName, setPartName] = useState('')
  const [partNumber, setPartNumber] = useState('')
  // Kept as text while typing — a controlled number input seeded with 0/1
  // keeps the old digit in front of what you type ("0900"). Converted on save.
  const [partQty, setPartQty] = useState('1')
  const [partUnitPrice, setPartUnitPrice] = useState('')
  const [partStatus, setPartStatus] = useState<'in-stock' | 'to-order'>('to-order')

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

  // The customer's actual decision on THIS quotation — unlike preDiagnostic.status,
  // which reflects the latest pre_diagnostics round for the whole job order and can
  // still read 'approved' from an earlier stage (e.g. the inspection) even though
  // no quotation has been sent yet. This is what should lock editing.
  const quotationApproved = initial.quotationApproved

  function updateLaborCost(serviceId: string, laborCost: number) {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, laborCost } : s)))
    setHasUnsavedChanges(true)
  }

  function updateLaborHours(serviceId: string, laborHours: number) {
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, laborHours } : s)))
    setHasUnsavedChanges(true)
  }

  function openAddPartModal(serviceId: string) {
    setPartModalServiceId(serviceId)
    setEditingPartId(null)
    setPartName('')
    setPartNumber('')
    setPartQty('1')
    setPartUnitPrice('')
    setPartStatus('to-order')
    setShowPartModal(true)
  }

  // Same modal, prefilled — saving replaces the row instead of appending.
  function openEditPartModal(serviceId: string, part: QuotationPart) {
    setPartModalServiceId(serviceId)
    setEditingPartId(part.id)
    setPartName(part.name)
    setPartNumber(part.partNo)
    setPartQty(String(part.qty))
    setPartUnitPrice(String(part.unitPrice))
    setPartStatus(part.status)
    setShowPartModal(true)
  }

  function removePart(serviceId: string, partId: string) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, parts: s.parts.filter((p) => p.id !== partId) } : s)),
    )
    setHasUnsavedChanges(true)
  }

  function confirmPart() {
    const name = partName.trim()
    if (!name || !partModalServiceId) return
    const serviceId = partModalServiceId
    const draft = {
      name,
      partNo: partNumber.trim() || `PRT-${Math.floor(Math.random() * 9000 + 1000)}`,
      qty: Math.max(1, Number(partQty) || 1),
      unitPrice: Math.max(0, Number(partUnitPrice) || 0),
      status: partStatus,
    }
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s
        if (editingPartId) {
          return { ...s, parts: s.parts.map((p) => (p.id === editingPartId ? { ...p, ...draft } : p)) }
        }
        return { ...s, parts: [...s.parts, { id: `${serviceId}-p${Date.now()}`, ...draft }] }
      }),
    )
    setHasUnsavedChanges(true)
    setShowPartModal(false)
  }
  // Saves the quotation draft to the database without sending for approval.
  async function saveDraft() {
    setSavingDraft(true)
    setSavedDraft(false)
    try {
      const servicesWithEstimates = services.map(s => {
        const prediction = aiPredictions[s.id]
        return {
          ...s,
          estimated_amount: prediction?.predicted_amount || s.estimated_amount || s.laborCost,
          actual_amount: s.laborCost
        }
      })

      const estimated_grand_total = servicesWithEstimates.reduce((sum, s) => sum + Number(s.estimated_amount), 0) + totals.partsTotal
      const actual_grand_total = totals.grandTotal

      await fetch(`/api/job-orders/${jobOrderId}/quotation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, services: servicesWithEstimates, estimated_grand_total, actual_grand_total }),
      })
      setSavedDraft(true)
      setHasUnsavedChanges(false)
      setTimeout(() => setSavedDraft(false), 3000)
    } catch (e) {
      console.error('Failed to save quotation', e)
    }
    setSavingDraft(false)
  }

  // Sends the full quotation (services + parts + total) for approval — a
  // real, persisted database write (creates a new pre_diagnostics round).
  async function sendQuotationForApproval() {
    setSending(true)

    // First save the quotation services and notes
    await saveDraft()


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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="quotation" stage={jobOrder.stage} />

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
            disabled={preDiagnostic?.status === 'pending' || quotationApproved}
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
            <div className="flex gap-2">
              <button
                onClick={saveDraft}
                disabled={savingDraft || savedDraft || sending || quotationApproved}
                className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 ${hasUnsavedChanges ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}
              >
                {savingDraft ? 'Saving...' : savedDraft ? '✓ Draft Saved' : hasUnsavedChanges ? '* Save Draft' : 'Save Draft'}
              </button>
              <button
                onClick={sendQuotationForApproval}
                disabled={sending || quotationApproved}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Send size={14} />{' '}
                {sending
                  ? 'Sending…'
                  : quotationApproved
                  ? 'Approved by customer'
                  : 'Send to Customer'}
              </button>
            </div>
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
                        disabled={preDiagnostic?.status === 'pending' || quotationApproved}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {editing ? <Check size={13} /> : <Pencil size={13} />} {editing ? 'Done' : 'Edit'}
                      </button>
                      <button
                        onClick={() => removeService(s.id)}
                        disabled={preDiagnostic?.status === 'pending' || quotationApproved}
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
                    onClick={() => openAddPartModal(s.id)}
                    disabled={preDiagnostic?.status === 'pending' || quotationApproved}
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
                        <th className="px-3 py-2 text-right font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.parts.map((p) => (
                        <tr key={p.id} className="group border-t border-slate-100">
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
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditPartModal(s.id, p)}
                                disabled={preDiagnostic?.status === 'pending' || quotationApproved}
                                title="Edit part"
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => removePart(s.id, p.id)}
                                disabled={preDiagnostic?.status === 'pending' || quotationApproved}
                                title="Remove part"
                                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {s.parts.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">
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

          {payment && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-bold text-slate-900"><CreditCard size={16} /> Payment Verification</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    payment.verificationStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : payment.verificationStatus === 'rejected'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {payment.verificationStatus}
                </span>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="font-semibold text-slate-800">{currency(payment.amountPaid)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="font-semibold text-slate-800">{payment.paymentChannel ?? payment.paymentMethod}</span></div>
                {payment.referenceNumber && (
                  <div className="flex justify-between"><span className="text-slate-400">Reference No.</span><span className="font-semibold text-slate-800">{payment.referenceNumber}</span></div>
                )}
              </div>

              {payment.proofOfPaymentImage && (
                <button type="button" onClick={() => setShowProofLightbox(true)} className="mt-3 block w-full">
                  <img
                    src={payment.proofOfPaymentImage}
                    alt="Proof of payment"
                    className="h-32 w-full rounded-lg border border-slate-200 object-cover hover:opacity-90"
                  />
                  <p className="mt-1 text-center text-[10px] text-slate-400">Click to view full size</p>
                </button>
              )}

              {payment.verificationStatus === 'pending' && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleVerifyPayment('rejected')}
                    disabled={verifyingPayment}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button
                    onClick={() => handleVerifyPayment('verified')}
                    disabled={verifyingPayment}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <Check size={14} /> {verifyingPayment ? 'Saving…' : 'Verify'}
                  </button>
                </div>
              )}
            </div>
          )}

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
            <p className="flex items-center gap-1.5 font-bold text-slate-900"><ClipboardCheck size={16} /> Inspection Findings</p>
            <p className="mt-0.5 text-xs text-slate-400">What the mechanic found, as approved by the customer.</p>
            {findings.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">No findings were recorded.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {findings.map((f) => {
                  const meta = findingStatusMeta[f.status] ?? findingStatusMeta['needs-attention']
                  return (
                    <div key={f.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{f.name}</p>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.classes}`}>
                          {meta.label}
                        </span>
                      </div>
                      {f.note && <p className="mt-1 text-xs text-slate-600">{f.note}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-bold text-slate-900">📝 Quotation Notes</p>
            <p className="mb-2 mt-0.5 text-xs text-slate-400">Internal — for the shop, not shown to the customer.</p>
            {editingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setHasUnsavedChanges(true); }}
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


          {/* One-time handoff, like "Continue to Quotation" on the inspection
              page: hidden once the job is actually on the floor. Blocked while
              a downpayment is still unverified — the shop's policy is that
              work doesn't start until the money is confirmed. */}
          {quotationApproved && jobOrder.stage !== 'in-progress' && jobOrder.stage !== 'completed' && (() => {
            const paymentBlocks =
              payment?.verificationStatus === 'pending'
                ? "Verify the customer's payment first"
                : payment?.verificationStatus === 'rejected'
                ? 'Payment was rejected — the customer needs to resubmit'
                : null
            return (
              <button
                onClick={continueToServiceProgress}
                disabled={startingWork || Boolean(paymentBlocks)}
                title={paymentBlocks ?? undefined}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {startingWork ? 'Starting…' : 'Continue to Service Progress'} <ChevronRight size={15} />
              </button>
            )
          })()}
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

      {showPartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShowPartModal(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><PackagePlus size={18} className="text-emerald-600" /> {editingPartId ? 'Edit Part' : 'Add Part'}</h3>
              <button onClick={() => setShowPartModal(false)} className="rounded-full p-1 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Part Name</label>
                <input
                  autoFocus
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g. Front Brake Pad Set"
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Part Number <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  placeholder="Auto-generated if left blank"
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unit Price (₱)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={partUnitPrice}
                    onChange={(e) => setPartUnitPrice(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Availability</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPartStatus('in-stock')}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${partStatus === 'in-stock' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    In Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartStatus('to-order')}
                    className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${partStatus === 'to-order' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  >
                    To Order
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-900">{currency(Math.max(1, Number(partQty) || 1) * Math.max(0, Number(partUnitPrice) || 0))}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowPartModal(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmPart} disabled={!partName.trim()} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-600 active:scale-95 disabled:opacity-50">
                {editingPartId ? <Check size={14} /> : <PackagePlus size={14} />} {editingPartId ? 'Save Part' : 'Add Part'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProofLightbox && payment?.proofOfPaymentImage && (
        <Lightbox url={payment.proofOfPaymentImage} label="Proof of payment" onClose={() => setShowProofLightbox(false)} />
      )}
    </div>
  )
}