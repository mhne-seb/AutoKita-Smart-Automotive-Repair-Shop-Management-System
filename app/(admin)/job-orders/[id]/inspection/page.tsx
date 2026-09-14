'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from "next/link";
import { Camera, Plus, Pencil, Trash2, Check, X, Cloud, Clock, ChevronRight, CheckCircle2, Loader2, Maximize2, AlertCircle, ScanLine, Info, ClipboardList, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { compressImage } from '@/lib/image'
import { DIAGNOSTIC_SCAN_FEE, formatPeso } from '@/data/diagnosticScan'
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
  // Severity is staged here while editing and only written on Save, so picking
  // a chip no longer commits (and discards) an in-progress name/note edit.
  const [editFindingStatus, setEditFindingStatus] = useState<FindingStatus>('ok')
  const [approvalDecision, setApprovalDecision] = useState<'pending' | 'confirmed' | 'reverted'>('pending')

  // Real "send for approval" round — replaces the old local `uploaded` flag.
  const [preDiagnostic, setPreDiagnostic] = useState<PreDiagnosticRound | null | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [respondingTo, setRespondingTo] = useState<'approved' | 'disputed' | null>(null)

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // While the customer is reviewing the report we sent them, it must not change
  // underneath them — the record they approve has to be the record we sent.
  // And once they've approved it, it's final: that exact record is what they
  // agreed to. Everything stays visible, just not editable. Only 'disputed'
  // (or no round yet) is editable, since that's when the mechanic revises.
  const isApproved = preDiagnostic?.status === 'approved'
  const isLocked = preDiagnostic?.status === 'pending' || isApproved

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setPhotoSlots(initial.photoSlots)
      setFindings(initial.findings)
      setNotes(initial.notes)
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
    if (!file || isLocked) return

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

  // Opens the editor with every field seeded from the finding, so the form
  // never shows leftovers from whichever finding was edited before it.
  function startEditingFinding(f: MechanicalFinding) {
    if (isLocked) return
    setEditingFindingId(f.id)
    setEditFindingName(f.name)
    setEditFindingNote(f.note)
    setEditFindingStatus(f.status)
  }

  async function updateFindingContent(fId: string, name: string, note: string, status: FindingStatus) {
    if (isLocked || !name.trim() || !note.trim()) return
    setFindings((prev) => prev.map((f) => (f.id === fId ? { ...f, name, note, status } : f)))
    setEditingFindingId(null)

    await updateInspectionFinding(jobOrderId, { id: fId, name, note, status })
  }

  async function deleteFinding(fId: string) {
    if (isLocked) return
    // Optimistic update
    setFindings((prev) => prev.filter((f) => f.id !== fId))

    // API Call
    await deleteInspectionFinding(jobOrderId, fId)
  }

  async function addFinding() {
    if (isLocked || editingFindingId !== null) return
    const newFindingData = {
      name: '',
      note: '',
      status: 'ok' as FindingStatus,
    }

    // API Call to get real ID
    const added = await addInspectionFinding(jobOrderId, newFindingData)
    if (added) {
      setFindings((prev) => [...prev, added])
      setEditingFindingId(added.id)
      setEditFindingName('')
      setEditFindingNote('')
      setEditFindingStatus(added.status)
    }
  }

  // Cancels an in-progress edit. A brand-new finding that was never actually
  // filled in has nothing worth keeping, so it's deleted outright instead of
  // being left behind as a blank row.
  function cancelEditingFinding(f: MechanicalFinding) {
    setEditingFindingId(null)
    if (!f.name.trim() && !f.note.trim()) {
      void deleteFinding(f.id)
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

  // The side column only ever holds the pull-out review card or the
  // "Continue to Quotation" link — reserve its width only when one of those
  // actually has something to show, otherwise let the report use the full page.
  const hasSidebar = Boolean(initial.request) || Boolean(initial.pullOutRequested) || (isApproved && !initial.quotationStarted)

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="inspection" stage={jobOrder.stage} />

      <div className={hasSidebar ? "grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]" : "block"}>
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
              disabled={sending || isLocked}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-default disabled:bg-emerald-600"
            >
              {preDiagnostic?.status === 'disputed' ? (
                  <AlertCircle size={15} /> 
                ) : preDiagnostic ? (
                <CheckCircle2 size={15} /> 
                ) : ( 
                <Cloud size={15} /> 
                )}
              {sending
                ? 'Sending…'
                : preDiagnostic?.status === 'pending'
                ? 'Awaiting customer approval'
                : preDiagnostic?.status === 'approved'
                ? 'Approved by customer'
                : preDiagnostic?.status === 'disputed'
                ? 'Customer has concerns - revise and send again'
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

            {/* The mechanic's go-ahead for the scanner. Without this the
                customer never agreed to the fee, so don't plug it in. */}
            {initial.diagnosticScanAuthorized ? (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <ScanLine size={16} className="flex-shrink-0" />
                <span>
                  <b>OBD-II scan authorized.</b> The customer agreed to the{' '}
                  {formatPeso(DIAGNOSTIC_SCAN_FEE)} diagnostic fee at booking — it&apos;s already on
                  this job order.
                </span>
              </div>
            ) : (
              // The customer was never asked about the scanner at booking (their
              // category didn't require it, or they booked under "Others"). If
              // you end up using it anyway, tell them about the fee before you
              // plug it in — don't let them find out for the first time on the
              // quotation.
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <Info size={16} className="flex-shrink-0" />
                <span>
                  <b>Heads up:</b> the customer wasn&apos;t told about the {formatPeso(DIAGNOSTIC_SCAN_FEE)} scanner
                  fee when they booked. If you need to use the scanner, tell the customer about the fee first.
                </span>
              </div>
            )}

            {preDiagnostic?.status === 'pending' && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <Clock size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Locked while the customer reviews this report</p>
                  <p className="mt-0.5 text-amber-800">
                    The customer is reviewing the findings you sent. The report can&apos;t be edited
                    until they approve or raise a concern, so the record they act on is exactly the
                    one you submitted.
                  </p>
                </div>
              </div>
            )}

            {isApproved && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Approved by the customer — this report is final</p>
                  <p className="mt-0.5 text-emerald-800">
                    This is the exact record the customer agreed to, so it can no longer be changed.
                    Anything new goes on the quotation.
                  </p>
                </div>
              </div>
            )}

            {preDiagnostic?.status === 'disputed' && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">The customer has a concern with this report</p>
                  {preDiagnostic.customerReason ? (
                    <p className="mt-1.5 rounded-md bg-white/70 px-3 py-2 italic text-rose-950">
                      &ldquo;{preDiagnostic.customerReason}&rdquo;
                    </p>
                  ) : (
                    <p className="mt-0.5 text-rose-800">No reason was recorded.</p>
                  )}
                  <p className="mt-1.5 text-rose-800">
                    Call the customer to talk it through, update the findings below, then send the
                    report again.
                    {preDiagnostic.respondedAt && ` Raised ${preDiagnostic.respondedAt}.`}
                  </p>
                </div>
              </div>
            )}

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
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          disabled={uploadingSlot === slot.id}
                          className="absolute bottom-2 right-2 z-10 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 opacity-0 shadow group-hover:opacity-100 hover:bg-white"
                        >
                          Replace
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[slot.id]?.click()}
                      disabled={uploadingSlot === slot.id || isLocked}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 disabled:cursor-not-allowed"
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
                disabled={isLocked}
                placeholder="Add a note about this inspection..."
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              <button
                onClick={saveNote}
                disabled={isLocked}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
                disabled={isLocked || editingFindingId !== null}
                title={editingFindingId !== null ? 'Finish editing the current finding first' : undefined}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
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
                              placeholder="New finding"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                            />
                            <textarea
                              value={editFindingNote}
                              onChange={(e) => setEditFindingNote(e.target.value)}
                              rows={2}
                              placeholder="Describe what was found..."
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              onClick={() => updateFindingContent(f.id, editFindingName, editFindingNote, editFindingStatus)}
                              disabled={!editFindingName.trim() || !editFindingNote.trim()}
                              title={!editFindingName.trim() || !editFindingNote.trim() ? 'Fill in both fields before saving' : undefined}
                              className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-indigo-600"
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
                                onClick={() => setEditFindingStatus(s)}
                                aria-pressed={editFindingStatus === s}
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-opacity ${findingStatusMeta[s].classes} ${
                                  editFindingStatus === s
                                    ? 'ring-2 ring-slate-900/20 ring-offset-1'
                                    : 'opacity-40 hover:opacity-75'
                                }`}
                              >
                                {findingStatusMeta[s].label}
                              </button>
                            ))}
                            <button onClick={() => cancelEditingFinding(f)} className="ml-1 rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-white">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditingFinding(f)}
                            disabled={isLocked}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:cursor-not-allowed ${meta.classes}`}
                          >
                            {meta.label}
                          </button>
                        )}
                        <button
                          onClick={() => startEditingFinding(f)}
                          disabled={isLocked}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteFinding(f.id)}
                          disabled={isLocked}
                          className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {hasSidebar && (
          <div className="space-y-6">
              {/* What the customer asked for at booking. Read this before
                  inspecting — it's the reason the car is here. */}
              {initial.request && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-slate-500" />
                    <p className="text-sm font-bold text-slate-900">Customer&apos;s Request</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">What they asked for when they booked.</p>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Service requested</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{initial.request.category ?? 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Service type</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{initial.request.serviceMode}</p>
                      {initial.request.homeAddress && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-slate-500">
                          <MapPin size={12} className="mt-0.5 flex-shrink-0" /> {initial.request.homeAddress}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Requested on</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{initial.request.requestedOn}</p>
                      {initial.request.requestedSlot && (
                        <p className="mt-1 text-xs text-slate-500">Preferred slot: {initial.request.requestedSlot}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-slate-400">Customer&apos;s notes</p>
                    {initial.request.notes ? (
                      <p className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        &ldquo;{initial.request.notes}&rdquo;
                      </p>
                    ) : !initial.request.category && initial.request.raw ? (
                      // Unrecognised format — show the ticket text as-is rather than hide it.
                      <p className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                        {initial.request.raw}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-400">No specific concerns given.</p>
                    )}
                  </div>
                </div>
              )}
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

            {/* One-time handoff: gone once the quotation has anything on it —
                after that the breadcrumb is the way there. */}
            {isApproved && !initial.quotationStarted && (
              <Link
                href={`/job-orders/${jobOrderId}/quotation`}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Continue to Quotation <ChevronRight size={15} />
              </Link>
            )}
          </div>
        )}
      </div>

      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}