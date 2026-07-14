'use client'

// Admin "Service Progress" page — the final step of the job-order workflow. Shows a section-by-section task checklist; once every task is marked done the job order is written back to "completed" (see jobOrderController.advanceJobOrderStage).
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ListChecks } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { JobOrderBreadcrumb } from '../components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getQuotationById } from '@/controllers/quotationController'
import { getServiceProgressById } from '@/controllers/serviceProgressController'
import { currency } from '../data/mockData'
import { ServiceSection, TaskStatus, JobOrderCard } from '../data/types'

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
  const quotation = getQuotationById(jobOrderId)
  const initial = getServiceProgressById(jobOrderId)

  useEffect(() => {
    let active = true
    getJobOrderById(jobOrderId).then((data) => {
      if (active) setJobOrder(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [sections, setSections] = useState<ServiceSection[]>(initial?.sections ?? [])
  const [quotationConfirmed, setQuotationConfirmed] = useState(initial?.quotationConfirmed ?? false)

  const allTasks = useMemo(() => sections.flatMap((s) => s.tasks), [sections])
  const completedCount = allTasks.filter((t) => t.status === 'completed').length

  const quotationTotal = useMemo(() => {
    if (!quotation) return 0
    return quotation.services.reduce(
      (sum, s) => sum + s.laborCost + s.parts.reduce((pSum, p) => pSum + p.qty * p.unitPrice, 0),
      0
    )
  }, [quotation])

  if (jobOrder === undefined) {
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
                  task.status === 'active' ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleCheckbox(task.id, task.status)}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      task.status === 'completed'
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : task.status === 'active'
                        ? 'border-indigo-400 text-transparent hover:text-indigo-400'
                        : 'border-slate-200 text-transparent'
                    }`}
                  >
                    <Check size={13} />
                  </button>
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      {task.title}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          task.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'active'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {task.status}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">{task.note}</p>
                    <p className="mt-1 text-xs text-slate-400">🕐 {task.time}</p>
                  </div>
                </div>
                {task.status === 'active' && (
                  <button
                    onClick={() => markDone(task.id)}
                    className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Mark Done
                  </button>
                )}
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
    </div>
  )
}
