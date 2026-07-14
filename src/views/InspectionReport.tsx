'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from "next/link";
import { Camera, Plus, Pencil, Trash2, Check, X, Cloud, Clock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { JobOrderBreadcrumb } from '../components/dashboard/JobOrderBreadcrumb'
import { getJobOrderById, advanceJobOrderStage } from '@/controllers/jobOrderController'
import { getInspectionById } from '@/controllers/inspectionController'
import { FindingStatus, MechanicalFinding, findingStatusMeta, JobOrderCard } from '../data/types'

interface Props {
  jobOrderId: string
}

export function InspectionReport({ jobOrderId }: Props) {
  // Loaded through the controller (mock API) so this page is ready to point
  // at a real endpoint later — see src/controllers/jobOrderController.ts.
  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)
  const initial = getInspectionById(jobOrderId)

  useEffect(() => {
    let active = true
    getJobOrderById(jobOrderId).then((data) => {
      if (active) setJobOrder(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [photoSlots, setPhotoSlots] = useState(initial?.photoSlots ?? [])
  const [findings, setFindings] = useState<MechanicalFinding[]>(initial?.findings ?? [])
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState(initial?.notes ?? [])
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [timerRunning, setTimerRunning] = useState(initial?.timer.running ?? false)
  const [approvalDecision, setApprovalDecision] = useState<'pending' | 'confirmed' | 'reverted'>('pending')
  // Real (visible) state for the "Upload to customer portal" action, instead
  // of a bare alert() — the button reflects the action actually happened.
  const [uploaded, setUploaded] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useMemo(() => findings.filter((f) => f.status === 'ok').length, [findings])

  if (jobOrder === undefined) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Loading inspection…</p>
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

  function handlePhotoPick(slotId: string, file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url } : p)))
  }

  function saveNote() {
    if (!noteDraft.trim()) return
    setNotes((prev) => [
      { id: `n${prev.length + 1}`, author: 'Boss Boyet', timestamp: 'Just now', content: noteDraft.trim() },
      ...prev,
    ])
    setNoteDraft('')
  }

  function updateFindingStatus(fId: string, status: FindingStatus) {
    setFindings((prev) => prev.map((f) => (f.id === fId ? { ...f, status } : f)))
    setEditingFindingId(null)
  }

  function deleteFinding(fId: string) {
    setFindings((prev) => prev.filter((f) => f.id !== fId))
  }

  function addFinding() {
    const newFinding: MechanicalFinding = {
      id: `f${Date.now()}`,
      name: 'New finding',
      note: 'Describe what was found...',
      status: 'ok',
    }
    setFindings((prev) => [...prev, newFinding])
  }

  // Advances the shared mock job order to "quotation" so the Customer's
  // dashboard immediately reflects it (see jobOrderController for how the
  // two sides stay connected on mock data).
  function continueToQuotation() {
    void advanceJobOrderStage(jobOrderId, 'quotation')
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="inspection" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Inspection Report</p>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{initial.vehicleTitle}</h1>
                <span className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                  {initial.plate}
                </span>
              </div>
            </div>
            <button
              onClick={() => setUploaded(true)}
              disabled={uploaded}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-default disabled:bg-emerald-600"
            >
              {uploaded ? <CheckCircle2 size={15} /> : <Cloud size={15} />}
              {uploaded ? 'Uploaded to customer portal' : 'Upload to customer portal'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-6 grid grid-cols-4 gap-6 text-sm">
              <div>
                <p className="text-slate-400">Vehicle</p>
                <p className="font-bold text-slate-900">{initial.vehicleTitle}</p>
              </div>
              <div>
                <p className="text-slate-400">Plate No.</p>
                <p className="font-bold text-slate-900">{initial.plate}</p>
              </div>
              <div>
                <p className="text-slate-400">Customer</p>
                <p className="font-bold text-slate-900">{initial.customer}</p>
              </div>
              <div>
                <p className="text-slate-400">Job Order</p>
                <span className="inline-block rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                  JO-{jobOrderId.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {photoSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => fileInputRefs.current[slot.id]?.click()}
                  className="group relative flex h-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:border-slate-300"
                >
                  {slot.url ? (
                    <>
                      <img src={slot.url} alt={slot.label} className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100">
                        Replace photo
                      </span>
                    </>
                  ) : (
                    <>
                      <Camera size={20} />
                      {slot.label}
                    </>
                  )}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[slot.id] = el
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoPick(slot.id, e.target.files?.[0])}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Technician Workspace</h2>
              <p className="text-xs text-slate-400">These notes are visible to customers after upload</p>
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write technician notes..."
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-4 text-sm focus:border-slate-400 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">No files attached</span>
              <button
                onClick={saveNote}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                disabled={!noteDraft.trim()}
              >
                Save Note
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {notes.map((n) => (
                <div key={n.id} className="flex gap-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                    {n.author.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">
                      {n.author} <span className="ml-1 font-normal text-slate-400">· {n.timestamp}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{n.content}</p>
                    {n.photos && (
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {n.photos.map((p) => (
                          <div key={p.label}>
                            <p className="mb-1 text-xs text-slate-400">{p.label}</p>
                            <img src={p.url} alt={p.label} className="h-24 w-full rounded-lg object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">🔧 Mechanical Findings</h2>
              <button
                onClick={addFinding}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
              >
                <Plus size={14} /> Add Finding
              </button>
            </div>

            <div className="space-y-3">
              {findings.map((f) => {
                const meta = findingStatusMeta[f.status]
                const editing = editingFindingId === f.id
                return (
                  <div
                    key={f.id}
                    className={`rounded-xl border p-4 ${editing ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{f.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{f.note}</p>
                        {f.photo && <img src={f.photo} alt={f.name} className="mt-3 h-20 w-28 rounded-lg object-cover" />}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {editing ? (
                          <div className="flex items-center gap-1">
                            {(['ok', 'needs-attention', 'urgent'] as FindingStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => updateFindingStatus(f.id, s)}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${findingStatusMeta[s].classes}`}
                              >
                                {findingStatusMeta[s].label}
                              </button>
                            ))}
                            <button onClick={() => setEditingFindingId(null)} className="ml-1 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-white">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingFindingId(f.id)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.classes}`}
                          >
                            {meta.label}
                          </button>
                        )}
                        <button onClick={() => setEditingFindingId(f.id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteFinding(f.id)} className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50/60 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Customer review required</p>
                <p className="text-xs text-slate-500">
                  Customer can review service breakdowns, parts required, and estimated repair details before approval.
                </p>
              </div>
              <Link
                href={`/job-orders/${jobOrderId}/quotation`}
                className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-indigo-600 hover:underline"
              >
                Review Details <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Time Tracking</p>
            <p className="mb-4 text-sm font-bold text-slate-900">Active Job Timers</p>

            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{jobOrder.customer}</p>
                <p className="text-xs text-slate-400">{initial.vehicleTitle}</p>
              </div>
              <span className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500">
                JO-{jobOrderId.toUpperCase()}
              </span>
            </div>

            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Job Progress</span>
              <span className="text-slate-700">{initial.timer.progressPercent}%</span>
            </div>
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900" style={{ width: `${initial.timer.progressPercent}%` }} />
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
                <span className="font-semibold text-slate-800">{initial.timer.laborHoursEstimate} Hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Duration</span>
                <span className="font-semibold text-slate-800">{initial.timer.currentDurationHours} Hours</span>
              </div>
            </div>

            <button
              onClick={() => setTimerRunning((r) => !r)}
              className="mt-4 w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {timerRunning ? 'Pause Timer' : 'Resume Timer'}
            </button>
          </div>

          {initial.approvalRequired && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-500">Review Action</p>
              {approvalDecision === 'pending' && (
                <>
                  <p className="mb-1 font-bold text-rose-600">Approval Required</p>
                  <p className="mb-4 text-sm text-rose-500">
                    Decide whether to authorize the immediate release of the vehicle.
                  </p>
                  <button
                    onClick={() => setApprovalDecision('confirmed')}
                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Check size={15} /> Confirm Pull Out
                  </button>
                  <button
                    onClick={() => setApprovalDecision('reverted')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <X size={15} /> Revert Request
                  </button>
                </>
              )}
              {approvalDecision === 'confirmed' && (
                <p className="text-sm font-semibold text-emerald-600">Pull out confirmed. Vehicle cleared for release.</p>
              )}
              {approvalDecision === 'reverted' && (
                <p className="text-sm font-semibold text-slate-600">Request reverted back to inspection.</p>
              )}
            </div>
          )}

          <Link
            href={`/job-orders/${jobOrderId}/quotation`}
            onClick={continueToQuotation}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Continue to Quotation <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
