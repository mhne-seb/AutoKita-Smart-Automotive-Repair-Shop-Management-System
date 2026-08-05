'use client'

// Admin "Service Progress" page — the final step of the job-order workflow. Shows a section-by-section task checklist; once every task is marked done the job order is written back to "completed" (see jobOrderController.advanceJobOrderStage).
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks, CalendarDays, Clock, X } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { JobOrderBreadcrumb } from '../components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById } from '@/controllers/quotationController'
import { getServiceProgressById, scheduleTask } from '@/controllers/serviceProgressController'
import { currency } from '../data/mockData'
import { ServiceSection, TaskStatus, JobOrderCard, ServiceProgressData, QuotationData, ServiceTask } from '../data/types'

interface Props {
  jobOrderId: string
}

const sectionColors: Record<string, string> = {
  received: 'text-emerald-600',
  inspecting: 'text-emerald-600',
  quotation: 'text-amber-600',
  'in-progress': 'text-blue-600',
  complete: 'text-slate-500',
}

export function ServiceProgress({ jobOrderId }: Props) {
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

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setSections(initial.sections)
      setQuotationConfirmed(initial.quotationConfirmed)
    }
  }, [initial])

  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections])
  const completedCount = allTasks.filter((t) => t.status === 'completed').length

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

  function markDone(taskId: string) {
    setSections((prev) => {
      // Complete the chosen task, then activate the next pending task overall (any section).
      const flatIds = prev.flatMap((s) => s.tasks.map((t) => t.id))
      const idx = flatIds.indexOf(taskId)
      const nextId = flatIds[idx + 1]

      const next = prev.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          if (t.id === taskId) return { ...t, status: 'completed' as TaskStatus }
          if (t.id === nextId && t.status === 'pending') return { ...t, status: 'active' as TaskStatus }
          return t
        }),
      }))

      // Once every task across every section is done, write that back to the
      // shared job order so the Customer's dashboard reflects "Completed".
      const stillPending = next.some((s) => s.tasks.some((t) => t.status !== 'completed'))
      if (!stillPending) void advanceJobOrderStage(jobOrderId, 'completed')

      return next
    })
  }

  function toggleCheckbox(taskId: string, status: TaskStatus) {
    if (status === 'completed' || status === 'active') markDone(taskId)
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="progress" />

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

      {sections.length === 0 ? (
        <div className="mx-auto max-w-[1000px] rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
          No service progress tasks recorded yet for this job order.
        </div>
      ) : (
        <div className="mx-auto max-w-[1000px] space-y-6">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <p className={`text-sm font-bold uppercase tracking-wide ${sectionColors[section.id] ?? 'text-slate-500'}`}>
                {section.title}
              </p>
              {section.tasks.map((task) => (
                  <div
                    key={task.id}
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
                    
                    <div className="shrink-0 ml-4 flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          task.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'active'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {task.status === 'completed' ? 'Finished' : task.status === 'active' ? 'Started' : 'Not Yet'}
                      </span>
                    </div>
                  </div>
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

  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [mechanicId, setMechanicId] = useState<number | ''>(task.mechanicId || '')
  const [note, setNote] = useState(task.note === 'Describe the service...' ? '' : (task.note || ''))
  
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const datetime = `${date}T${time}:00`
    await scheduleTask(jobOrderId, task.id, datetime, status, mechanicId === '' ? undefined : mechanicId, note)
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

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Status</label>
            <div className="flex gap-2">
              <button onClick={() => setStatus('pending')} className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${status === 'pending' ? 'bg-slate-200 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Not Yet</button>
              <button onClick={() => setStatus('active')} className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${status === 'active' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Started</button>
              <button onClick={() => setStatus('completed')} className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${status === 'completed' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Finished</button>
            </div>
          </div>
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