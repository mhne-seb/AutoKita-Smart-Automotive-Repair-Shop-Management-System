'use client'

// Admin "Service Progress" page — the final step of the job-order workflow. Shows a section-by-section task checklist; once every task is marked done the job order is written back to "completed" (see jobOrderController.advanceJobOrderStage).
import { useParams } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks, CalendarDays, Clock, X, Timer, Play, Package, PackageCheck, Loader2, CreditCard, XCircle, Banknote, Camera, Upload, Car, Receipt, Plus } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Lightbox } from '@/components/Lightbox'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById, getJobOrderBill, verifyJobOrderPayment, type JobOrderBill } from '@/controllers/quotationController'
import { getServiceProgressById, scheduleTask, setPartStatus, finishTask, getSuppliers, addSupplier, recordPartsPurchase } from '@/controllers/serviceProgressController'
import { isRoadTest } from '@/data/roadTest'
import { mechanicIsFull } from '@/data/mechanicPolicy'
import { currency } from '@/data/mockData'
import { ServiceSection, TaskStatus, JobOrderCard, ServiceProgressData, QuotationData, ServiceTask, TaskPart, PartsPurchase, Supplier, partIsReady } from '@/data/types'

const sectionColors: Record<string, string> = {
  received: 'text-emerald-600',
  inspecting: 'text-emerald-600',
  quotation: 'text-amber-600',
  'in-progress': 'text-blue-600',
  complete: 'text-slate-500',
}

export default function page() {
  const jobOrderId = String(useParams().id)
  // Loaded through the controller (mock API) — see jobOrderController.ts.
  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)

  // Quotation data is now fetched from the real database asynchronously —
  // loaded via useEffect/state instead of being read synchronously at render time.
  const [quotation, setQuotation] = useState<QuotationData | null | undefined>(undefined)

  // Service progress now comes from the real database, which is an async
  // call — so it's loaded via useEffect/state, same as jobOrder, instead of
  // being read synchronously at render time.
  const [initial, setInitial] = useState<ServiceProgressData | null | undefined>(undefined)

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
      if (active) setQuotation(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  useEffect(() => {
    let active = true
    getServiceProgressById(jobOrderId).then((data) => {
      if (active) setInitial(data ?? null)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [scheduleData, setScheduleData] = useState<{tasks: any[], mechanics: any[]}>({ tasks: [], mechanics: [] })

  // Final bill — what the job costs, what's verified, and the payment the
  // customer most recently submitted for the admin to check. Only matters
  // once the job is completed; loaded regardless so the card is instant.
  const [bill, setBill] = useState<JobOrderBill | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; label: string } | null>(null)
  const loadBill = () => getJobOrderBill(jobOrderId).then(setBill)
  useEffect(() => { void loadBill() }, [jobOrderId])
  async function decidePayment(decision: 'verified' | 'rejected') {
    const p = bill?.latestPayment
    if (!p) return
    setVerifying(true)
    const ok = await verifyJobOrderPayment(jobOrderId, p.id, decision)
    setVerifying(false)
    if (!ok) return toast.error('Could not update the payment.')
    toast.success(decision === 'verified' ? 'Payment verified.' : 'Payment rejected — the customer will be asked to resubmit.')
    void loadBill()
  }
  
  useEffect(() => {
    let active = true
    fetch('/api/admin/schedule')
      .then(r => r.json())
      .then(d => {
        if (active && d.success) {
          setScheduleData({ tasks: d.tasks || [], mechanics: d.mechanics || [] })
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const [sections, setSections] = useState<ServiceSection[]>([])
  const [quotationConfirmed, setQuotationConfirmed] = useState(false)
  const [schedulingTask, setSchedulingTask] = useState<ServiceTask | null>(null)
  // Which task / part has a request in flight (declared here, above the early
  // returns, so the hook order is identical on every render).
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null)
  const [busyPartId, setBusyPartId] = useState<number | null>(null)
  const [finishingTask, setFinishingTask] = useState<ServiceTask | null>(null)

  // "Record purchase" — the shop's ledger of where to-order parts were bought.
  // One save creates one purchase record and marks the ticked parts received.
  const [purchases, setPurchases] = useState<PartsPurchase[]>([])
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [purchaseDate, setPurchaseDate] = useState('')
  // Per part: is it in this purchase, and what did one unit cost.
  const [purchaseLines, setPurchaseLines] = useState<Record<number, { checked: boolean; unitCost: string }>>({})
  const [savingPurchase, setSavingPurchase] = useState(false)

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setSections(initial.sections)
      setQuotationConfirmed(initial.quotationConfirmed)
      setPurchases(initial.purchases)
    }
  }, [initial])

  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections])

  // Every part on this job order still waiting to be bought. Tasks that share
  // a service name share the same parts list, so dedupe by part id.
  const partsToBuy = useMemo(() => {
    const seen = new Map<number, TaskPart>()
    for (const t of allTasks) for (const p of t.parts ?? []) if (p.status === 'to_order') seen.set(p.id, p)
    return [...seen.values()]
  }, [allTasks])
  const completedCount = allTasks.filter((t) => t.status === 'completed').length
  const progressPercent = allTasks.length === 0 ? 0 : Math.round((completedCount / allTasks.length) * 100)

  // Job-order clock. Ticks once a minute while the job is on the floor so
  // "Current Duration" is live; freezes at completed_at once it's done.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!initial?.timer.startedAtIso || initial.timer.completedAtIso) return
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [initial?.timer.startedAtIso, initial?.timer.completedAtIso])

  const currentDurationHours = useMemo(() => {
    const start = initial?.timer.startedAtIso
    if (!start) return 0
    const end = initial?.timer.completedAtIso ? new Date(initial.timer.completedAtIso).getTime() : now
    return Math.max(0, Math.round(((end - new Date(start).getTime()) / 36e5) * 10) / 10)
  }, [initial?.timer.startedAtIso, initial?.timer.completedAtIso, now])

  const laborHoursEstimate = useMemo(() => {
    const fromQuotation = quotation?.services.reduce((sum, s) => sum + (s.laborHours || 0), 0) ?? 0
    return fromQuotation > 0 ? Math.round(fromQuotation * 10) / 10 : (initial?.timer.estimatedDurationHours ?? 0)
  }, [quotation, initial?.timer.estimatedDurationHours])

  // Job-level finish = the latest estimate across ALL tasks — the same number
  // the task cards show, rolled up. Finished tasks count too, so it's one
  // stable date for the whole job rather than jumping to whichever task is
  // left. (job_orders.date_promised is never set anywhere in the app, so
  // reading it just gives '—' forever.)
  const estimatedFinish = useMemo(() => {
    const withEstimate = allTasks.filter((t) => t.estimatedFinish)
    if (withEstimate.length === 0) return null
    return withEstimate.reduce<Date | null>((latest, t) => {
      const d = new Date(t.estimatedFinish!)
      return !latest || d > latest ? d : latest
    }, null)
  }, [allTasks])

  const quotationTotal = useMemo(() => {
    if (!quotation) return 0
    return quotation.services.reduce(
      (sum, s) => sum + s.laborCost + s.parts.reduce((pSum, p) => pSum + p.qty * p.unitPrice, 0),
      0
    )
  }, [quotation])

  if (jobOrder === undefined || initial === undefined || quotation === undefined) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Loading service progress…</p>
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

  async function refreshTasks() {
    const data = await getServiceProgressById(jobOrderId)
    if (data) {
      setSections(data.sections)
      setPurchases(data.purchases)
    }
  }

  // Start lives on the card — one tap, in the moment. Schedule/mechanic/note
  // are passed through unchanged (the stored function is a full update).
  async function setTaskStatus(task: ServiceTask, next: TaskStatus) {
    setBusyTaskId(task.id)
    const result = await scheduleTask(jobOrderId, task.id, task.scheduledDate ?? null, next, task.mechanicId, task.note)
    if (!result.ok) toast.error(result.message ?? 'Could not update the task.')
    await refreshTasks()
    setBusyTaskId(null)
  }

  // Finish is a photo upload (shop policy: show the finished work). What
  // happens to the job afterwards — road test created, job completed — is
  // decided on the server, not here.
  async function handleFinish(task: ServiceTask, photo: File): Promise<boolean> {
    const result = await finishTask(jobOrderId, task.id, photo)
    if (!result.ok) {
      toast.error(result.message ?? 'Could not finish the task.')
      return false
    }
    if (result.roadTestCreated) toast.success('All services done — Road Test added. Drive it before handing it back.')
    else if (result.jobCompleted) toast.success('Road test finished — job order is now Completed.')
    else toast.success(`${task.title} finished.`)
    await refreshTasks()
    if (result.jobCompleted) getJobOrderById(jobOrderId).then((jo) => jo && setJobOrder(jo))
    return true
  }

  // No inventory system — the only fact about a part is "has it arrived".
  async function togglePartReceived(part: TaskPart) {
    setBusyPartId(part.id)
    await setPartStatus(jobOrderId, part.id, partIsReady(part) ? 'to_order' : 'received')
    await refreshTasks()
    setBusyPartId(null)
  }

  async function openPurchaseModal() {
    setSuppliers(await getSuppliers())
    setSupplierId('')
    setNewSupplierName('')
    setAddingSupplier(false)
    setPurchaseDate(new Date().toISOString().slice(0, 10))
    // Every to-order part starts ticked — untick the ones bought elsewhere.
    setPurchaseLines(Object.fromEntries(partsToBuy.map((p) => [p.id, { checked: true, unitCost: '' }])))
    setShowPurchaseModal(true)
  }

  async function handleAddSupplier() {
    const name = newSupplierName.trim()
    if (!name) return
    const created = await addSupplier(name)
    if (!created) return toast.error('Could not add that supplier.')
    setSuppliers((prev) => (prev.some((s) => s.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))))
    setSupplierId(created.id)
    setNewSupplierName('')
    setAddingSupplier(false)
  }

  const purchaseTotal = partsToBuy.reduce((sum, p) => {
    const line = purchaseLines[p.id]
    return line?.checked ? sum + (Number(line.unitCost) || 0) * p.qty : sum
  }, 0)
  const purchaseCount = partsToBuy.filter((p) => purchaseLines[p.id]?.checked).length

  async function savePurchase() {
    if (!supplierId) return toast.error('Pick a supplier first.')
    const lines = partsToBuy
      .filter((p) => purchaseLines[p.id]?.checked)
      .map((p) => ({ partId: p.id, unitCost: Number(purchaseLines[p.id].unitCost) }))
    if (lines.length === 0) return toast.error('Tick at least one part.')
    if (lines.some((l) => !(l.unitCost >= 0) || Number.isNaN(l.unitCost))) return toast.error('Enter a cost for every ticked part.')

    setSavingPurchase(true)
    const result = await recordPartsPurchase(jobOrderId, Number(supplierId), purchaseDate, lines)
    setSavingPurchase(false)
    if (!result.ok) return toast.error(result.message ?? 'Could not save the purchase.')
    toast.success(`Purchase recorded — ${lines.length} part${lines.length === 1 ? '' : 's'} marked received.`)
    setShowPurchaseModal(false)
    await refreshTasks()
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." showSearch={false} />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="progress" stage={jobOrder.stage} />

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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Service Timeline</h1>
          <p className="text-sm text-slate-400">Check off each task as it is completed.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
          <ListChecks size={15} /> {completedCount}/{allTasks.length} Tasks Done
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
      <div>
      {sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          No service progress tasks recorded yet for this job order.
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <p className={`text-sm font-bold uppercase tracking-wide ${sectionColors[section.id] ?? 'text-slate-500'}`}>
                {section.title}
              </p>
              {section.tasks.map((task) => (
                  <Fragment key={task.id}>
                  <div
                    className={`rounded-xl border p-4 ${
                       task.status === 'active' ? 'border-indigo-300 bg-indigo-50/50 cursor-pointer' : task.status === 'completed' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                    }`}
                    onClick={() => task.status !== 'completed' && setSchedulingTask(task)}
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="flex items-center gap-2 font-semibold text-slate-900 transition-colors">
                          {task.title}
                          {isRoadTest(task) && (
                            <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700"><Car size={11} /> Quality check</span>
                          )}
                        </h3>
                        {task.note && task.note !== 'Describe the service...' && (
                          <p className="mt-0.5 text-sm text-slate-500 truncate">{task.note}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                          {/* Finish time — only meaningful once the task is done. (Per-task
                              elapsed needs started_at, which the schema doesn't have yet.) */}
                          {task.status === 'completed' && task.time !== '—' && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600">🕐 Finished {task.time}</span>
                          )}
                          {task.photoUrl && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setLightboxPhoto({ url: task.photoUrl!, label: `${task.title} — finished work` }) }}
                              className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                            >
                              <img src={task.photoUrl} alt="" className="h-4 w-4 rounded-sm object-cover" /> Photo
                            </button>
                          )}
                          {task.startedAt && (
                            <span className="flex items-center gap-1 font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                              <Clock size={13} />
                              Started: {new Date(task.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          {task.mechanicName && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Assigned to: {task.mechanicName}
                            </span>
                          )}
                          {task.scheduledDate && (
                            <span className="flex items-center gap-1 font-semibold text-indigo-600">
                              <CalendarDays size={13} />
                              Scheduled: {new Date(task.scheduledDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          {/* A Started task past its estimate is overdue. A Not-Yet task past its
                              estimate is a scheduling problem, not an overdue one, so it stays amber. */}
                          {task.estimatedFinish && (() => {
                            const est = new Date(task.estimatedFinish)
                            const overdueHrs = task.status === 'active' ? (Date.now() - est.getTime()) / 3600000 : 0
                            const label = est.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                            // Est. Finish is scheduled start + predicted duration, so the
                            // duration is just the gap between the two.
                            const estHrs = task.scheduledDate ? (est.getTime() - new Date(task.scheduledDate).getTime()) / 3600000 : 0
                            const hrsLabel = estHrs > 0 ? ` (${estHrs % 1 === 0 ? estHrs : estHrs.toFixed(1)} hrs)` : ''
                            return overdueHrs > 0 ? (
                              <span className="flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                Overdue by {overdueHrs < 1 ? `${Math.round(overdueHrs * 60)} min` : `${overdueHrs.toFixed(1)} hrs`} (est. {label})
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                Est. Finish: {label}{hrsLabel}
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {(() => {
                      const parts = task.parts ?? []
                      const missing = parts.filter((p) => !partIsReady(p))
                      const busy = busyTaskId === task.id
                      // Nobody can start work that nobody's been assigned to.
                      // Date + mechanic are both set in the schedule modal, so
                      // "schedule it first" is the whole instruction.
                      const unscheduled = !task.scheduledDate || !task.mechanicId
                      return (
                        <div className="shrink-0 ml-4 flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {/* A task that simply hasn't started gets no badge — the Start
                              button (or its "schedule first" hint) already says so.
                              Waiting on parts is a real state, so that one stays. */}
                          {(task.status !== 'pending' || missing.length > 0) && (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                task.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : task.status === 'active'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {task.status === 'completed' ? 'Finished' : task.status === 'active' ? 'Started' : 'Waiting for parts'}
                            </span>
                          )}

                          {/* Start is blocked until the task is scheduled to a mechanic
                              and every part for it has arrived — work doesn't begin on
                              a car missing parts, or with no one assigned to do it. */}
                          {task.status === 'pending' && (
                            <button
                              onClick={() => setTaskStatus(task, 'active')}
                              disabled={busy || missing.length > 0 || unscheduled}
                              title={
                                unscheduled
                                  ? 'Schedule this task and assign a mechanic first (click the card)'
                                  : missing.length > 0
                                  ? `Waiting for parts (${parts.length - missing.length} of ${parts.length} received)`
                                  : undefined
                              }
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Start
                            </button>
                          )}
                          {task.status === 'active' && (
                            <button
                              onClick={() => setFinishingTask(task)}
                              disabled={busy}
                              title="Upload a photo of the finished work to mark this done"
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-95 disabled:opacity-40"
                            >
                              <Camera size={13} /> Finish
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Parts this service needs, as a table inside the card. One
                      row per part; "Received" marks it arrived (Undo for a
                      mis-tap). Hidden once the task is finished. */}
                  {task.status !== 'completed' && (task.parts?.length ?? 0) > 0 && (() => {
                    const parts = task.parts!
                    const received = parts.filter(partIsReady).length
                    return (
                      <div className="mt-3 border-t border-slate-200 pt-3" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                          <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide"><Package size={12} /> Parts · {received} of {parts.length} received</span>
                          {received < parts.length && <span>Mark each part when it arrives</span>}
                        </div>
                        <table className="w-full text-sm">
                          <tbody>
                            {parts.map((p) => {
                              const ready = partIsReady(p)
                              const busyP = busyPartId === p.id
                              return (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="py-2 pr-3">
                                    <div className="font-semibold text-slate-800">{p.name}</div>
                                    {p.purchaseOrderId && (
                                      <div className="text-[11px] text-slate-400">PO-{p.purchaseOrderId} · {p.supplierName} · {p.purchasedOn}</div>
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 text-xs text-slate-400">{p.partNo}</td>
                                  <td className="py-2 pr-3 text-xs text-slate-500">×{p.qty}</td>
                                  <td className="py-2 pr-3 text-right">
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {ready ? (p.status === 'in_stock' ? 'In stock' : 'Received') : 'To order'}
                                    </span>
                                  </td>
                                  <td className="w-28 py-2 text-right">
                                    <button
                                      onClick={() => togglePartReceived(p)}
                                      disabled={busyP}
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                                        ready
                                          ? 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                          : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {busyP ? <Loader2 size={12} className="animate-spin" /> : ready ? null : <PackageCheck size={12} />}
                                      {ready ? 'Undo' : 'Received'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                  </div>
                  </Fragment>
              ))}

              {section.id === 'quotation' && quotation && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">Service Quotation</p>
                      <p className="text-sm text-slate-400">Review recommended services and confirm to proceed</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        quotationConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {quotationConfirmed ? 'Confirmed' : 'Awaiting Approval'}
                    </span>
                  </div>

                  <table className="mb-3 w-full text-sm">
                    <thead className="text-xs text-slate-400">
                      <tr>
                        <th className="pb-2 text-left font-medium">Description</th>
                        <th className="pb-2 text-left font-medium">Type</th>
                        <th className="pb-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotation.services.map((s) => (
                        <Fragment key={s.id}>
                          {s.parts.map((p) => (
                            <tr key={p.id} className="border-t border-slate-100">
                              <td className="py-2">{p.name}</td>
                              <td className="py-2"><span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">Part</span></td>
                              <td className="py-2 text-right font-semibold">{currency(p.qty * p.unitPrice)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-slate-100">
                            <td className="py-2">{s.name}</td>
                            <td className="py-2"><span className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-600">Labor</span></td>
                            <td className="py-2 text-right font-semibold">{currency(s.laborCost)}</td>
                          </tr>
                        </Fragment>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-bold text-slate-900">
                    <span>Total Estimate</span>
                    <span>{currency(quotationTotal)}</span>
                  </div>

                  {!quotationConfirmed ? (
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => setQuotationConfirmed(true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <Check size={15} /> Confirm & Proceed
                      </button>
                      <button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                        Request Changes
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm font-semibold text-emerald-600">
                      ✓ Quotation confirmed by customer — proceeding to In Progress.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      <div className="space-y-6">
        {/* The job-order clock — restored from the Inspection page, where it
            didn't belong. Starts by itself when the job enters in_progress
            (advance_job_order_stage stamps started_at); there's no manual
            pause/resume — per-service Started/Finished is the real control. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Timer size={13} /> Time Tracking</p>

          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">{jobOrder.customer}</p>
              <p className="text-xs text-slate-400">{jobOrder.vehicle}</p>
            </div>
            <span className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500">
              JO-{jobOrderId.toUpperCase()}
            </span>
          </div>

          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Job Progress</span>
            <span className="text-slate-700">{progressPercent}%</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400"><Clock size={13} /> Started</span>
              <span className="font-semibold text-slate-800">{initial.timer.startedAt}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400"><Clock size={13} /> Estimated Finish</span>
              <span className={`font-semibold ${estimatedFinish && !initial.timer.completedAtIso && estimatedFinish.getTime() < now ? 'text-rose-600' : 'text-slate-800'}`}>
                {estimatedFinish
                  ? estimatedFinish.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : allTasks.length === 0
                  ? '—'
                  : 'Schedule tasks first'}
              </span>
            </div>
          </div>

          <div className="my-4 border-t border-slate-100" />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Labor Hours (Est.)</span>
              <span className="font-semibold text-slate-800">{laborHoursEstimate} hrs</span>
            </div>
            <div className="flex items-center justify-between">
              {/* Wall-clock since the job hit the floor (overnight included), so comparing
                  it to labor hours is meaningless — no red here. Overdue lives on the task cards. */}
              <span className="text-slate-400">{initial.timer.completedAtIso ? 'Total Time in Shop' : 'Time in Shop'}</span>
              <span className="font-semibold text-slate-800">
                {currentDurationHours} hrs
              </span>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            {initial.timer.startedAtIso
              ? initial.timer.completedAtIso
                ? 'Finished — the clock stopped when the last task was completed.'
                : 'Running since the job went onto the floor. Mark each task Started / Finished below to track individual services.'
              : 'The clock starts when the job enters In Progress.'}
          </p>
        </div>

        {/* Where the shop bought this job's to-order parts. Recording a
            purchase is what normally marks parts received — the per-row
            "Received" button on the task cards stays as a manual fallback. */}
        {(partsToBuy.length > 0 || purchases.length > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Package size={13} /> Parts to Buy</p>
              {partsToBuy.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{partsToBuy.length}</span>
              )}
            </div>

            {partsToBuy.length === 0 ? (
              <p className="text-sm text-slate-400">Nothing left to buy.</p>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 text-sm">
                  {partsToBuy.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-1.5">
                      <span className="text-slate-800">{p.name}</span>
                      <span className="text-xs text-slate-400">×{p.qty}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={openPurchaseModal}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-slate-800 active:scale-[0.98]"
                >
                  <Receipt size={14} /> Record Purchase
                </button>
              </>
            )}

            {purchases.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Purchases</p>
                <ul className="space-y-1.5 text-sm">
                  {purchases.map((pu) => (
                    <li key={pu.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-slate-700">
                        <span className="font-semibold text-slate-900">PO-{pu.id}</span> · {pu.supplierName}
                        <span className="text-xs text-slate-400"> · {pu.purchasedOn} · {pu.partCount} part{pu.partCount === 1 ? '' : 's'}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-slate-800">{currency(pu.totalCost)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Final bill + verification. Same three numbers the customer sees
            (services + parts − verified payments), so the two screens never
            disagree. Shown once the job is done — that's when the balance is
            collectable. A cash choice sits here as 'pending' until the admin
            confirms the money is in hand. */}
        {bill && (jobOrder.stage === 'completed' || bill.paid > 0) && (() => {
          const p = bill.latestPayment
          const status = p?.verificationStatus
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><CreditCard size={13} /> Final Bill</p>
                {bill.balance <= 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Paid in full</span>
                ) : status === 'pending' ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">To verify</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Unpaid</span>
                )}
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Total</span><span className="font-semibold text-slate-800">{currency(bill.total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Paid (verified)</span><span className="font-semibold text-slate-800">− {currency(bill.paid)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-1.5"><span className="font-semibold text-slate-700">Balance</span><span className={`text-lg font-bold ${bill.balance <= 0 ? 'text-emerald-600' : 'text-slate-900'}`}>{currency(bill.balance)}</span></div>
              </div>

              {p && bill.balance > 0 && status !== 'verified' && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-700">{status === 'pending' ? 'Waiting for your check' : 'Last submission'}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{status}</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="font-semibold text-slate-800">{currency(p.amountPaid)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="font-semibold text-slate-800">{p.paymentMethod === 'cash' ? 'Cash at counter' : p.paymentChannel ?? p.paymentMethod}</span></div>
                    {p.referenceNumber && <div className="flex justify-between"><span className="text-slate-400">Reference No.</span><span className="font-semibold text-slate-800">{p.referenceNumber}</span></div>}
                  </div>
                  {p.proofOfPaymentImage && (
                    <button type="button" onClick={() => setShowProof(true)} className="mt-2 block w-full">
                      <img src={p.proofOfPaymentImage} alt="Proof of payment" className="h-28 w-full rounded-lg border border-slate-200 object-cover hover:opacity-90" />
                      <p className="mt-1 text-center text-[10px] text-slate-400">Click to view full size</p>
                    </button>
                  )}
                  {status === 'pending' && (
                    p.paymentMethod === 'cash' ? (
                      <button
                        onClick={() => decidePayment('verified')}
                        disabled={verifying}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
                      >
                        <Banknote size={14} /> {verifying ? 'Saving…' : `Confirm ${currency(p.amountPaid)} cash received`}
                      </button>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => decidePayment('rejected')}
                          disabled={verifying}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white py-2 text-xs font-semibold text-rose-600 transition-all duration-150 hover:bg-rose-50 active:scale-[0.98] disabled:opacity-50"
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button
                          onClick={() => decidePayment('verified')}
                          disabled={verifying}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
                        >
                          <Check size={14} /> {verifying ? 'Saving…' : 'Verify'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {!p && bill.balance > 0 && (
                <p className="mt-3 text-[11px] text-slate-400">The customer hasn't submitted a payment yet. They'll see "Pay Remaining Balance" on their completed page.</p>
              )}
            </div>
          )
        })()}
      </div>
      </div>

      {finishingTask && (
        <FinishTaskModal
          task={finishingTask}
          onClose={() => setFinishingTask(null)}
          onSubmit={async (photo) => {
            const ok = await handleFinish(finishingTask, photo)
            if (ok) setFinishingTask(null)
            return ok
          }}
        />
      )}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !savingPurchase && setShowPurchaseModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Record Parts Purchase</h3>
              <button onClick={() => setShowPurchaseModal(false)} disabled={savingPurchase} className="rounded-full p-1 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
            </div>
            <p className="mb-4 text-sm text-slate-500">Where these parts came from, for the shop&apos;s records.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Supplier</label>
                {addingSupplier ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleAddSupplier() }}
                      placeholder="Supplier name"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                    <button onClick={handleAddSupplier} disabled={!newSupplierName.trim()} className="rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">Add</button>
                  </div>
                ) : (
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                  >
                    <option value="">Select a supplier…</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => { setAddingSupplier((v) => !v); setNewSupplierName('') }}
                  className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                >
                  {addingSupplier ? 'Pick an existing supplier instead' : <><Plus size={12} /> Add new supplier</>}
                </button>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Date Purchased</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <p className="mb-1.5 mt-4 text-sm font-semibold text-slate-700">
              Parts in this purchase <span className="font-normal text-slate-400">— untick anything bought elsewhere</span>
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {partsToBuy.map((p) => {
                const line = purchaseLines[p.id] ?? { checked: false, unitCost: '' }
                return (
                  <div key={p.id} className={`flex items-center gap-3 border-t border-slate-100 px-3 py-2 first:border-t-0 ${line.checked ? '' : 'bg-slate-50 text-slate-400'}`}>
                    <input
                      type="checkbox"
                      checked={line.checked}
                      onChange={(e) => setPurchaseLines((prev) => ({ ...prev, [p.id]: { ...line, checked: e.target.checked } }))}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{p.name} <span className="font-normal text-slate-400">×{p.qty}</span></div>
                      <div className="text-xs text-slate-400">{p.partNo}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">₱/unit</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitCost}
                        disabled={!line.checked}
                        onChange={(e) => setPurchaseLines((prev) => ({ ...prev, [p.id]: { ...line, unitCost: e.target.value } }))}
                        onFocus={(e) => e.target.select()}
                        placeholder="0.00"
                        className="w-24 rounded-lg border border-slate-200 p-1.5 text-right text-sm text-slate-700 outline-none focus:border-emerald-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold text-slate-700">Total paid to supplier · {purchaseCount} part{purchaseCount === 1 ? '' : 's'}</span>
                <span className="font-bold text-slate-900">{currency(purchaseTotal)}</span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">Saving marks the ticked parts received.</span>
              <div className="flex gap-2">
                <button onClick={() => setShowPurchaseModal(false)} disabled={savingPurchase} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
                <button
                  onClick={savePurchase}
                  disabled={savingPurchase || !supplierId || purchaseCount === 0}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {savingPurchase ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />} {savingPurchase ? 'Saving…' : 'Save Record'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {lightboxPhoto && <Lightbox url={lightboxPhoto.url} label={lightboxPhoto.label} onClose={() => setLightboxPhoto(null)} />}
      {showProof && bill?.latestPayment?.proofOfPaymentImage && (
        <Lightbox url={bill.latestPayment.proofOfPaymentImage} label="Proof of payment" onClose={() => setShowProof(false)} />
      )}
      
      {schedulingTask && (
        <ScheduleModal 
          task={schedulingTask} 
          jobOrderId={jobOrderId}
          scheduleData={scheduleData}
          onClose={() => setSchedulingTask(null)}
          onSaved={() => {
            setSchedulingTask(null)
            getServiceProgressById(jobOrderId).then((data) => {
              if (data) setSections(data.sections)
            })
            // refresh schedule data
            fetch('/api/admin/schedule')
              .then(r => r.json())
              .then(d => { if(d.success) setScheduleData({ tasks: d.tasks || [], mechanics: d.mechanics || [] }) })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}

// Finishing a task = proving it. One photo, required; nothing else to fill in.
function FinishTaskModal({ task, onClose, onSubmit }: { task: ServiceTask; onClose: () => void; onSubmit: (photo: File) => Promise<boolean> }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setError(null)
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setError('Use a JPEG, PNG or WebP image.')
    if (f.size > 5 * 1024 * 1024) return setError('Image must be under 5MB.')
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async () => {
    if (!file) return
    setSaving(true)
    const ok = await onSubmit(file)
    if (!ok) setSaving(false)
  }

  const roadTest = isRoadTest(task)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Finish {task.title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {roadTest
                ? 'Upload a photo from the road test — e.g. the dashboard with no warning lights.'
                : 'Upload a photo of the finished work. Required — it goes on the customer\u2019s record.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="mt-5">
          {preview ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <img src={preview} alt="Finished work" className="aspect-video w-full object-cover" />
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="truncate text-slate-500">{file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB</span>
                <label className="shrink-0 cursor-pointer font-semibold text-indigo-600 hover:underline">
                  Replace
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
                </label>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/40">
              <Upload size={22} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">Click to choose a photo</span>
              <span className="text-xs text-slate-400">JPEG, PNG or WebP · up to 5MB</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
            </label>
          )}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button
            onClick={submit}
            disabled={!file || saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> Mark Finished</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// "YYYY-MM-DD" in local time. (toISOString() is UTC — in Manila that reads
// as yesterday until 8 AM, which would let the picker allow a past date.)
function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Same rule as the customer booking form: a slot is past only if it's
// earlier than right now — a past day, or today at a time already gone.
function isPastDateTime(date: string, time: string): boolean {
  if (!date || !time) return false
  return new Date(`${date}T${time}:00`).getTime() < Date.now()
}

// 09:00 is the shop's default — unless that's already gone today, in which
// case the next full hour is the first sensible pick.
function defaultTimeFor(date: string): string {
  if (date !== toLocalDateValue(new Date()) || !isPastDateTime(date, '09:00')) return '09:00'
  const next = new Date()
  next.setHours(next.getHours() + 1, 0, 0, 0)
  return `${String(next.getHours()).padStart(2, '0')}:00`
}

function ScheduleModal({ task, jobOrderId, scheduleData, onClose, onSaved }: { task: ServiceTask, jobOrderId: string, scheduleData: { tasks: any[], mechanics: any[] }, onClose: () => void, onSaved: () => void }) {
  const today = toLocalDateValue(new Date())

  const [date, setDate] = useState(() => {
    if (task.scheduledDate) {
      // Postgres returns local time timestamp natively as UTC Date on some clients,
      // but since we send exact string and read exact string we can extract local values directly
      return toLocalDateValue(new Date(task.scheduledDate))
    }
    return today
  })

  const [time, setTime] = useState(() => {
    if (task.scheduledDate) {
      const d = new Date(task.scheduledDate)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return defaultTimeFor(today)
  })

  // Only a not-yet-started task can be rescheduled, so that's the only case
  // where a past pick is a mistake worth blocking.
  const pickedPast = task.status === 'pending' && isPastDateTime(date, time)

  const [mechanicId, setMechanicId] = useState<number | ''>(task.mechanicId || '')
  const [note, setNote] = useState(task.note === 'Describe the service...' ? '' : (task.note || ''))
  
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const datetime = `${date}T${time}:00`
    // Status isn't set here — Start/Finish live on the task card.
    const result = await scheduleTask(jobOrderId, task.id, datetime, task.status, mechanicId === '' ? undefined : mechanicId, note)
    setSaving(false)
    if (!result.ok) {
      toast.error(result.message ?? 'Could not save the schedule.')
      return
    }
    onSaved()
  }

  const handleQuickPick = (daysToAdd: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysToAdd)
    const picked = toLocalDateValue(d)
    setDate(picked)
    setTime(defaultTimeFor(picked))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Schedule Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100"><X size={20}/></button>
        </div>
        
        <div className="mb-6 rounded-lg bg-slate-50 p-4 border border-slate-100">
          <p className="font-semibold text-slate-900 mb-2">{task.title}</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Service notes (optional)..."
            className="w-full rounded-md border border-slate-200 p-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none min-h-[80px]"
          />
        </div>

        <div className="space-y-4">
          {/* Quick picks only make sense before the task has started. */}
          {task.status === 'pending' && (
            <div className="flex gap-2">
              <button onClick={() => handleQuickPick(0)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Today</button>
              <button onClick={() => handleQuickPick(1)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tomorrow</button>
              <button onClick={() => handleQuickPick(2)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">In 2 Days</button>
            </div>
          )}

          {/* Once started, the schedule is history — read-only. Mechanic and
              note below stay editable (reassignment mid-task is legitimate). */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} disabled={task.status !== 'pending'} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Time</label>
              <input type="time" value={time} min={date === today ? new Date().toTimeString().slice(0, 5) : undefined} onChange={e => setTime(e.target.value)} disabled={task.status !== 'pending'} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500" />
            </div>
          </div>
          {pickedPast && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
              <XCircle size={13} /> That time has already passed — pick a later one.
            </p>
          )}
          {task.status === 'active' && (
            <p className="text-xs text-slate-500">
              Already started — the schedule is locked. You can still reassign the mechanic or update the note.
            </p>
          )}
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 mt-4">Assign Mechanic</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Unassigned --</option>
              {scheduleData.mechanics.map((m) => {
                const open = Number(m.open_tasks ?? 0)
                const cap = Number(m.capacity)
                // A full mechanic can't take a NEW task, but stays selectable
                // for a task that's already theirs (re-saving the schedule).
                const full = mechanicIsFull(open, cap) && task.mechanicId !== m.id
                return (
                  <option key={m.id} value={m.id} disabled={full}>
                    {m.full_name} ({open}/{cap}{full ? ' — full' : ''})
                  </option>
                )
              })}
            </select>
            {(() => {
              const m = scheduleData.mechanics.find((x) => x.id === mechanicId)
              if (!m) return null
              const open = Number(m.open_tasks ?? 0)
              const cap = Number(m.capacity)
              const wouldAdd = task.mechanicId !== m.id
              return (
                <p className={`mt-1.5 text-xs ${mechanicIsFull(open, cap) && wouldAdd ? 'text-rose-600' : 'text-slate-500'}`}>
                  {open} of {cap} open tasks{wouldAdd ? ` — this would make ${open + 1}` : ' (including this one)'}.
                  {mechanicIsFull(open, cap) && wouldAdd && ' At the limit — finish one of theirs first or pick someone else.'}
                </p>
              )
            })()}
          </div>

          {/* Overlap / Daily Schedule View */}
          {mechanicId !== '' && (
            <div className="mt-4 rounded-lg bg-indigo-50/50 p-4 border border-indigo-100">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-2">
                Mechanic's Schedule for {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              {(() => {
                const dayTasks = scheduleData.tasks.filter(t => 
                  t.mechanic_id === mechanicId && 
                  t.scheduled_date && 
                  new Date(t.scheduled_date).toISOString().split('T')[0] === date &&
                  String(t.id) !== task.id
                );
                
                if (dayTasks.length === 0) {
                  return <p className="text-sm text-indigo-600">No other tasks scheduled for this day.</p>;
                }

                // Check for direct overlap (assuming 1 hour duration for simple check)
                const proposedTime = new Date(`${date}T${time}:00`).getTime();
                const overlaps = dayTasks.filter(t => {
                  const tTime = new Date(t.scheduled_date).getTime();
                  return Math.abs(tTime - proposedTime) < 60 * 60 * 1000; // within 1 hour
                });

                return (
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                    {overlaps.length > 0 && (
                      <div className="mb-2 rounded bg-red-100 px-3 py-2 text-xs font-medium text-red-800 border border-red-200 flex items-start gap-2">
                        <span className="mt-0.5">⚠️</span>
                        <span>Warning: Potential overlap. The mechanic has tasks scheduled around this time.</span>
                      </div>
                    )}
                    {dayTasks.map(t => (
                      <div key={t.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-indigo-100 shadow-sm">
                        <span className="font-semibold text-slate-700 truncate mr-2 flex-1">{t.title}</span>
                        <span className="text-indigo-600 font-medium shrink-0">
                          {new Date(t.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
        
        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || pickedPast || (() => {
              const m = scheduleData.mechanics.find((x) => x.id === mechanicId)
              return Boolean(m && task.mechanicId !== m.id && mechanicIsFull(Number(m.open_tasks ?? 0), Number(m.capacity)))
            })()}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : <><Check size={16}/> Save</>}
          </button>
        </div>
      </div>
    </div>
  )
}