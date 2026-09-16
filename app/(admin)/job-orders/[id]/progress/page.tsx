'use client'

// Admin "Service Progress" page — the final step of the job-order workflow. Shows a section-by-section task checklist; once every task is marked done the job order is written back to "completed" (see jobOrderController.advanceJobOrderStage).
import { useParams } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks, CalendarDays, Clock, X, Timer, Play, Package, PackageCheck, Loader2, CreditCard, XCircle, Banknote } from 'lucide-react'
import { toast } from 'sonner'
import { Lightbox } from '@/components/Lightbox'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById, getJobOrderBill, verifyJobOrderPayment, type JobOrderBill } from '@/controllers/quotationController'
import { getServiceProgressById, scheduleTask, setPartStatus } from '@/controllers/serviceProgressController'
import { currency } from '@/data/mockData'
import { ServiceSection, TaskStatus, JobOrderCard, ServiceProgressData, QuotationData, ServiceTask, TaskPart, partIsReady } from '@/data/types'

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

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setSections(initial.sections)
      setQuotationConfirmed(initial.quotationConfirmed)
    }
  }, [initial])

  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections])
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
    if (data) setSections(data.sections)
  }

  // Start / Finish live on the card, not in the modal — one tap, in the
  // moment. Schedule/mechanic/note are passed through unchanged (the stored
  // function is a full update). When Jubert adds started_at, the 'Started'
  // tap is what stamps it — nothing here needs to change.
  async function setTaskStatus(task: ServiceTask, next: TaskStatus) {
    setBusyTaskId(task.id)
    await scheduleTask(jobOrderId, task.id, task.scheduledDate ?? null, next, task.mechanicId, task.note)
    const data = await getServiceProgressById(jobOrderId)
    if (data) {
      setSections(data.sections)
      // Every task done -> the job order itself is complete (customer's
      // tracker flips to "Completed").
      const all = data.sections.flatMap((s) => s.tasks)
      if (all.length > 0 && all.every((t) => t.status === 'completed')) {
        void advanceJobOrderStage(jobOrderId, 'completed')
      }
    }
    setBusyTaskId(null)
  }

  // No inventory system — the only fact about a part is "has it arrived".
  async function togglePartReceived(part: TaskPart) {
    setBusyPartId(part.id)
    await setPartStatus(jobOrderId, part.id, partIsReady(part) ? 'to_order' : 'received')
    await refreshTasks()
    setBusyPartId(null)
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
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
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      task.status === 'active' ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                    }`}
                    onClick={() => setSchedulingTask(task)}
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900 transition-colors">{task.title}</h3>
                        {task.note && task.note !== 'Describe the service...' && (
                          <p className="mt-0.5 text-sm text-slate-500 truncate">{task.note}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                          <span>🕐 {task.time}</span>
                          {task.scheduledDate && (
                            <span className="flex items-center gap-1 font-semibold text-indigo-600">
                              <CalendarDays size={13} />
                              Scheduled: {new Date(task.scheduledDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
                          {task.mechanicName && (
                            <span className="flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              Assigned to: {task.mechanicName}
                            </span>
                          )}
                          {task.estimatedFinish && (
                            <span className="flex items-center gap-1 font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              Est. Finish: {new Date(task.estimatedFinish).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </span>
                          )}
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
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              task.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : task.status === 'active'
                                ? 'bg-indigo-100 text-indigo-700'
                                : missing.length > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {task.status === 'completed' ? 'Finished' : task.status === 'active' ? 'Started' : missing.length > 0 ? 'Waiting for parts' : 'Not Yet'}
                          </span>

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
                              onClick={() => setTaskStatus(task, 'completed')}
                              disabled={busy}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:bg-emerald-700 active:scale-95 disabled:opacity-40"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Finish
                            </button>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Parts this service needs. Tap to mark one received (tap again
                      to undo a mis-tap). Hidden once the task is finished. */}
                  {task.status !== 'completed' && (task.parts?.length ?? 0) > 0 && (
                    <div className="ml-4 rounded-b-xl border border-t-0 border-slate-200 bg-slate-50 px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {task.parts!.map((p) => {
                          const ready = partIsReady(p)
                          const busyP = busyPartId === p.id
                          return (
                            <button
                              key={p.id}
                              onClick={() => togglePartReceived(p)}
                              disabled={busyP}
                              title={ready ? 'Received — tap to undo' : 'Tap when this part arrives'}
                              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                                ready
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                              }`}
                            >
                              {busyP ? <Loader2 size={12} className="animate-spin" /> : ready ? <PackageCheck size={12} /> : <Package size={12} />}
                              {p.qty > 1 ? `${p.qty}x ` : ''}{p.name}
                              <span className="font-normal opacity-70">- {ready ? (p.status === 'in_stock' ? 'in stock' : 'received') : 'to order'}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
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
              <span className="font-semibold text-slate-800">{initial.timer.estimatedFinish}</span>
            </div>
          </div>

          <div className="my-4 border-t border-slate-100" />

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Labor Hours (Est.)</span>
              <span className="font-semibold text-slate-800">{laborHoursEstimate} hrs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{initial.timer.completedAtIso ? 'Total Duration' : 'Current Duration'}</span>
              <span className={`font-semibold ${!initial.timer.completedAtIso && laborHoursEstimate > 0 && currentDurationHours > laborHoursEstimate ? 'text-rose-600' : 'text-slate-800'}`}>
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

function ScheduleModal({ task, jobOrderId, scheduleData, onClose, onSaved }: { task: ServiceTask, jobOrderId: string, scheduleData: { tasks: any[], mechanics: any[] }, onClose: () => void, onSaved: () => void }) {
  const [date, setDate] = useState(() => {
    if (task.scheduledDate) {
      // Postgres returns local time timestamp natively as UTC Date on some clients,
      // but since we send exact string and read exact string we can extract local values directly
      const d = new Date(task.scheduledDate)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return new Date().toISOString().split('T')[0]
  })
  
  const [time, setTime] = useState(() => {
    if (task.scheduledDate) {
      const d = new Date(task.scheduledDate)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return '09:00'
  })

  const [mechanicId, setMechanicId] = useState<number | ''>(task.mechanicId || '')
  const [note, setNote] = useState(task.note === 'Describe the service...' ? '' : (task.note || ''))
  
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const datetime = `${date}T${time}:00`
    // Status isn't set here — Start/Finish live on the task card.
    await scheduleTask(jobOrderId, task.id, datetime, task.status, mechanicId === '' ? undefined : mechanicId, note)
    setSaving(false)
    onSaved()
  }

  const handleQuickPick = (daysToAdd: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysToAdd)
    setDate(d.toISOString().split('T')[0])
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
          <div className="flex gap-2">
            <button onClick={() => handleQuickPick(0)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Today</button>
            <button onClick={() => handleQuickPick(1)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Tomorrow</button>
            <button onClick={() => handleQuickPick(2)} className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">In 2 Days</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 mt-4">Assign Mechanic</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
            >
              <option value="">-- Unassigned --</option>
              {scheduleData.mechanics.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
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
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70 flex items-center justify-center gap-2">
            {saving ? 'Saving...' : <><CalendarDays size={16}/> Save Schedule</>}
          </button>
        </div>
      </div>
    </div>
  )
}