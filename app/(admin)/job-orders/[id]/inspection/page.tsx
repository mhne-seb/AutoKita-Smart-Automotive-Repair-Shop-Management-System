'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from "next/link";
import { Camera, Plus, Pencil, Trash2, Check, X, Cloud, Clock, ChevronRight, CheckCircle2, Loader2, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { compressImage } from '@/lib/image'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { getInspectionById, addInspectionFinding, updateInspectionFinding, deleteInspectionFinding, uploadInspectionPhoto, saveWalkaroundNote } from '@/controllers/inspectionController'
import { getLatestPreDiagnostic, sendForApproval, type PreDiagnosticRound } from '@/controllers/preDiagnosticController'
import { FindingStatus, MechanicalFinding, findingStatusMeta, JobOrderCard, InspectionData, InspectionPhotoSlot } from '@/data/types'

export default function page() {
  const jobOrderId = String(useParams().id)
  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)

  // Inspection data now comes from the real database, which is an async
  // call — loaded via useEffect/state, same as jobOrder, instead of being
  // read synchronously at render time.
  const [initial, setInitial] = useState<InspectionData | null | undefined>(undefined)

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
    getInspectionById(jobOrderId).then((data) => {
      if (active) setInitial(data ?? null)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  useEffect(() => {
    let active = true
    getLatestPreDiagnostic(jobOrderId).then((data) => {
      if (active) setPreDiagnostic(data)
    })
    return () => {
      active = false
    }
  }, [jobOrderId])

  const [photoSlots, setPhotoSlots] = useState<InspectionData['photoSlots']>([])
  const [findings, setFindings] = useState<MechanicalFinding[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState<InspectionData['notes']>([])
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [editFindingName, setEditFindingName] = useState('')
  const [editFindingNote, setEditFindingNote] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [approvalDecision, setApprovalDecision] = useState<'pending' | 'confirmed' | 'reverted'>('pending')

  // Real "send for approval" round — replaces the old local `uploaded` flag.
  const [preDiagnostic, setPreDiagnostic] = useState<PreDiagnosticRound | null | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [respondingTo, setRespondingTo] = useState<'approved' | 'disputed' | null>(null)

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setPhotoSlots(initial.photoSlots)
      setFindings(initial.findings)
      setNotes(initial.notes)
      setTimerRunning(initial.timer.running)
    }
  }, [initial])

  useMemo(() => findings.filter((f) => f.status === 'ok').length, [findings])

  if (jobOrder === undefined || initial === undefined) {
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

  // Compress, upload, then keep the stored URL. The preview swaps to a local
  // copy immediately so the shot appears to land, but only the uploaded URL
  // survives a refresh.
  async function handlePhotoPick(slotId: string, label: string, file: File | undefined) {
    if (!file) return

    const previousUrl = photoSlots.find((p) => p.id === slotId)?.url
    const localUrl = URL.createObjectURL(file)
    setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url: localUrl } : p)))
    setUploadingSlot(slotId)

    try {
      const compressed = await compressImage(file)
      const uploaded = await uploadInspectionPhoto(jobOrderId, slotId, label, compressed)
      if (!uploaded) throw new Error('upload rejected')
      setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url: uploaded.url, rowId: uploaded.rowId } : p)))
      toast.success(`${label} photo saved`)
    } catch {
      setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url: previousUrl } : p)))
      toast.error(`Could not save the ${label} photo. Please try again.`)
    } finally {
      URL.revokeObjectURL(localUrl)
      setUploadingSlot(null)
    }
  }

    // Condition notes save on blur — one photo, one note, no separate Save button
  // to forget. Needs a row to write to, so a photo must be uploaded first.
  async function persistSlotNote(slot: InspectionPhotoSlot) {
    if (isLocked || !slot.rowId) return
    const ok = await saveWalkaroundNote(jobOrderId, slot.rowId, slot.note ?? '')
    if (!ok) toast.error(`Could not save the ${slot.label} note. Please try again.`)
  }

  function saveNote() {
    if (!noteDraft.trim()) return
    setNotes((prev) => [
      { id: `n${prev.length + 1}`, author: 'Boss Boyet', timestamp: 'Just now', content: noteDraft.trim() },
      ...prev,
    ])
    setNoteDraft('')
  }

  async function updateFindingStatus(fId: string, status: FindingStatus) {
    // Optimistic update
    setFindings((prev) => prev.map((f) => (f.id === fId ? { ...f, status } : f)))
    setEditingFindingId(null)
    
    // API Call
    await updateInspectionFinding(jobOrderId, { id: fId, status })
  }

  async function updateFindingContent(fId: string, name: string, note: string, status: FindingStatus) {
    setFindings((prev) => prev.map((f) => (f.id === fId ? { ...f, name, note, status } : f)))
    setEditingFindingId(null)

    await updateInspectionFinding(jobOrderId, { id: fId, name, note, status })
  }

  async function deleteFinding(fId: string) {
    // Optimistic update
    setFindings((prev) => prev.filter((f) => f.id !== fId))
    
    // API Call
    await deleteInspectionFinding(jobOrderId, fId)
  }

  async function addFinding() {
    const newFindingData = {
      name: 'New finding',
      note: 'Describe what was found...',
      status: 'ok' as FindingStatus,
    }
    
    // API Call to get real ID
    const added = await addInspectionFinding(jobOrderId, newFindingData)
    if (added) {
      setFindings((prev) => [...prev, added])
      setEditingFindingId(added.id)
      setEditFindingName(added.name)
      setEditFindingNote(added.note)
    }
  }

  // Sends the current findings for approval — a real, persisted database
  // write (creates a pre_diagnostics round) instead of the old fake local flag.
  async function sendInspectionForApproval() {
    setSending(true)
    const summary = findings.map((f) => `${f.name}: ${f.note}`).join(' | ') || 'No findings logged.'
    const round = await sendForApproval(jobOrderId, summary)
    if (round) {
      setPreDiagnostic(round)
      // The job order stays in `inspecting` until the CUSTOMER approves the
      // round from their portal — that's what advances it to quotation.
    }
    setSending(false)
  }

  // Removed simulate customer response logic

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
              onClick={sendInspectionForApproval}
              disabled={sending || Boolean(preDiagnostic && preDiagnostic.status === 'pending')}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-default disabled:bg-emerald-600"
            >
              {preDiagnostic ? <CheckCircle2 size={15} /> : <Cloud size={15} />}
              {sending
                ? 'Sending…'
                : preDiagnostic?.status === 'pending'
                ? 'Awaiting customer approval'
                : preDiagnostic?.status === 'approved'
                ? 'Approved by customer'
                : preDiagnostic?.status === 'disputed'
                ? 'Disputed — resend after changes'
                : 'Upload to customer portal'}
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
                <div key={slot.id} className="flex flex-col gap-2">
                  <div
                  className="group relative h-40 overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:border-slate-300"
                >
                  {slot.url ? (
                    <>
                      {/* The photo opens the viewer; replacing it is a separate
                          control, since one click can't mean both. */}
                      <button
                        type="button"
                        onClick={() => setLightbox({ url: slot.url!, label: slot.label })}
                        className="absolute inset-0 h-full w-full"
                      >
                        <img src={slot.url} alt={slot.label} className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 text-white opacity-0 group-hover:opacity-100">
                          <Maximize2 size={14} /> View
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[slot.id]?.click()}
                        disabled={uploadingSlot === slot.id}
                        className="absolute bottom-2 right-2 z-10 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 opacity-0 shadow group-hover:opacity-100 hover:bg-white"
                      >
                        Replace
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[slot.id]?.click()}
                      disabled={uploadingSlot === slot.id}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 disabled:cursor-wait"
                    >
                      <Camera size={20} />
                      {slot.label}
                    </button>
                  )}
                  {uploadingSlot === slot.id && (
                    <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-white">
                      <Loader2 size={16} className="animate-spin" /> Uploading…
                    </span>
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[slot.id] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {handlePhotoPick(slot.id, slot.label, e.target.files?.[0])
                      e.target.value = '' // re-picking the same file still fires onChange
                    }}
                  />
                </div>

                 <textarea
                  value={slot.note ?? ''}
                  onChange={(e) =>
                    setPhotoSlots((prev) => prev.map((p) => (p.id === slot.id ? { ...p, note: e.target.value } : p)))
                  }
                  onBlur={() => persistSlotNote(slot)}
                  disabled={isLocked || !slot.rowId}
                  rows={2}
                  placeholder={slot.rowId ? 'Condition on arrival — scratches, dents, existing damage…' : 'Upload a photo first'}
                  className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                />
                </div>
              ))}
            </div>

            <div className="my-6 border-t border-slate-100" />

            <p className="mb-3 text-sm font-bold text-slate-900">Technician Notes</p>
            <div className="mb-4 flex gap-2">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Add a note about this inspection..."
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <button
                onClick={saveNote}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add
              </button>
            </div>

            {notes.length === 0 ? (
              <p className="mb-6 text-sm text-slate-400">No technician notes yet.</p>
            ) : (
              <div className="mb-6 space-y-3">
                {notes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                    <p className="mb-1 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-600">{n.author}</span>
                      <span>{n.timestamp}</span>
                    </p>
                    <p className="text-slate-700">{n.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Mechanical Findings</p>
              <button
                onClick={addFinding}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Plus size={13} /> Add Finding
              </button>
            </div>

            <div className="space-y-3">
              {findings.map((f) => {
                const meta = findingStatusMeta[f.status] ?? findingStatusMeta['needs-attention']
                const editing = editingFindingId === f.id
                return (
                  <div
                    key={f.id}
                    className={`rounded-xl border p-4 ${editing ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 mr-4">
                        {editing ? (
                          <div className="space-y-2">
                            <input 
                              type="text" 
                              value={editFindingName} 
                              onChange={(e) => setEditFindingName(e.target.value)} 
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none"
                            />
                            <textarea 
                              value={editFindingNote} 
                              onChange={(e) => setEditFindingNote(e.target.value)} 
                              rows={2}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                            />
                            <button 
                              onClick={() => updateFindingContent(f.id, editFindingName, editFindingNote, f.status)}
                              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-900">{f.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{f.note}</p>
                            {f.photo && <img src={f.photo} alt={f.name} className="mt-3 h-20 w-28 rounded-lg object-cover" />}
                          </>
                        )}
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
                        <button 
                          onClick={() => {
                            setEditingFindingId(f.id)
                            setEditFindingName(f.name)
                            setEditFindingNote(f.note)
                          }} 
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                        >
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

          {initial.pullOutRequested && (
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



          {preDiagnostic?.status === 'approved' && (
            <Link
              href={`/job-orders/${jobOrderId}/quotation`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Continue to Quotation <ChevronRight size={15} />
            </Link>
          )}
        </div>
      </div>

      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}