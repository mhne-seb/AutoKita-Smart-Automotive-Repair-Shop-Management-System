'use client'

import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from "next/link";
import { Camera, Plus, Pencil, Trash2, Check, X, Cloud, Clock, ChevronRight, CheckCircle2, Loader2, Maximize2, AlertCircle, ScanLine, Info, ClipboardList, MapPin, FileText, Upload, Link2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { compressImage } from '@/lib/image'
import { DIAGNOSTIC_SCAN_FEE, formatPeso } from '@/data/diagnosticScan'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { getInspectionById, addInspectionFinding, updateInspectionFinding, deleteInspectionFinding, uploadInspectionPhoto, saveWalkaroundNote, saveWalkaroundTitle, deleteInspectionPhoto } from '@/controllers/inspectionController'
import { getLatestPreDiagnostic, sendForApproval, type PreDiagnosticRound } from '@/controllers/preDiagnosticController'
import { requestScanAuthorization } from '@/controllers/preDiagnosticController'
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
  // Set true after a blocked send attempt, so empty slots highlight red
  // until the admin fixes them (paper's Exception 1 on this use case).
  const [showPhotoWarning, setShowPhotoWarning] = useState(false)
  const [requestingScan, setRequestingScan] = useState(false)
  const [findings, setFindings] = useState<MechanicalFinding[]>([])
  // Passive save indicator beside "Upload to customer portal" — every photo
  // title/note/finding edit writes to the DB on its own (blur or immediately),
  // this just reflects whether that write is in flight, done, or failed.
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
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

  // ── OBD-II Diagnostic Report ──────────────────────────────────────────────
  interface Obd2Report {
    report_id: number
    scanner_tool: string | null
    scanner_software: string | null
    report_date: string | null
    test_mileage: number | null
    reported_make: string | null
    reported_model: string | null
    reported_year: number | null
    reported_engine: string | null
    reported_plate: string | null
    reported_vin: string | null
    source: string
    pdf_storage_url: string | null
    filename?: string | null
    linked_at: string | null
    linked_by_name: string | null
    datetime_created: string | null
  }
  interface DtcRow {
    dtc_id: number
    dtc_code: string
    dtc_description: string | null
    dtc_state: string | null
    dtc_system: string | null
  }
  interface UnlinkedReport {
    id: number
    scanner_tool: string | null
    report_date: string | null
    reported_vin?: string | null
    reported_make: string | null
    reported_model: string | null
    reported_year: number | null
    reported_plate: string | null
    filename?: string | null
    dtc_count: number
    datetime_created: string
  }

  const [obd2Report, setObd2Report] = useState<Obd2Report | null | undefined>(undefined)
  const [obd2Dtcs, setObd2Dtcs] = useState<DtcRow[]>([])
  const [obd2Loading, setObd2Loading] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [unlinkedReports, setUnlinkedReports] = useState<UnlinkedReport[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [showDtcs, setShowDtcs] = useState(true)
  const [unlinking, setUnlinking] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [deleteUnlinkedTarget, setDeleteUnlinkedTarget] = useState<UnlinkedReport | null>(null)
  const [deletingUnlinked, setDeletingUnlinked] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch the linked OBD-II report for this job order
  useEffect(() => {
    if (!jobOrderId) return
    fetch(`/api/diagnostics/job-order/${jobOrderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.report) {
          setObd2Report(data.report)
          setObd2Dtcs(data.dtc_codes ?? [])
        } else {
          setObd2Report(null)
        }
      })
      .catch(() => setObd2Report(null))
  }, [jobOrderId])

  async function openPicker() {
    setShowPicker(true)
    setPickerLoading(true)
    try {
      const res = await fetch('/api/diagnostics/unlinked')
      const data = await res.json()
      setUnlinkedReports(data.reports ?? [])
    } catch {
      setUnlinkedReports([])
    } finally {
      setPickerLoading(false)
    }
  }

  async function linkReport(reportId: number) {
    setLinkingId(reportId)
    try {
      // Use employee id 1 as placeholder — replace with session employee id
      const res = await fetch('/api/diagnostics/link', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId, job_order_id: Number(jobOrderId), employee_id: 1 }),
      })
      if (!res.ok) throw new Error('Link failed')
      // Re-fetch linked report
      const data = await fetch(`/api/diagnostics/job-order/${jobOrderId}`).then((r) => r.json())
      if (data.report) {
        setObd2Report(data.report)
        setObd2Dtcs(data.dtc_codes ?? [])
      }
      setShowPicker(false)
      toast.success('Diagnostic report linked to this job order')
    } catch {
      toast.error('Failed to link report. Please try again.')
    } finally {
      setLinkingId(null)
    }
  }

  async function handlePdfUpload(file: File) {
    setUploadingPdf(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('source', 'manual_upload')
      const res = await fetch('/api/diagnostics/store', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) throw new Error('Upload failed')
      const stored = await res.json()
      // Immediately link the uploaded report to this job order
      await linkReport(stored.report_id)
      toast.success('PDF uploaded and linked to this job order')
    } catch {
      toast.error('Failed to upload PDF. Please try again.')
    } finally {
      setUploadingPdf(false)
    }
  }

  async function handleDetachReport() {
    if (!obd2Report) return
    setUnlinking(true)
    try {
      const res = await fetch('/api/diagnostics/link', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: obd2Report.report_id,
          employee_id: 1,
        }),
      })
      if (!res.ok) throw new Error('Failed to detach report')

      setObd2Report(null)
      setObd2Dtcs([])
      setShowRemoveDialog(false)
      toast.success('Diagnostic report detached from this job order')
    } catch {
      toast.error('Failed to detach report. Please try again.')
    } finally {
      setUnlinking(false)
    }
  }

  async function handleDeleteUnlinkedReport(reportId: number) {
    setDeletingUnlinked(true)
    try {
      const res = await fetch('/api/diagnostics/unlinked', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: reportId,
          employee_id: 1,
        }),
      })
      if (!res.ok) throw new Error('Failed to delete report')

      setUnlinkedReports((prev) => prev.filter((r) => r.id !== reportId))
      setDeleteUnlinkedTarget(null)
      toast.success('Diagnostic report removed from system')
    } catch {
      toast.error('Failed to remove report. Please try again.')
    } finally {
      setDeletingUnlinked(false)
    }
  }

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // While the customer is reviewing the report we sent them, it must not change
  // underneath them — the record they approve has to be the record we sent.
  // And once they've approved it, it's final: that exact record is what they
  // agreed to. Everything stays visible, just not editable. Only 'disputed'
  // (or no round yet) is editable, since that's when the mechanic revises.
  //
  // pre_diagnostics holds the rounds for every stage (inspection first, then
  // quotation), and getLatestPreDiagnostic returns the newest one whatever it
  // is. Once the job has left 'inspecting' the inspection round is settled --
  // the customer's approval is what moved it -- so a later quotation round
  // (which may well be pending) must not make this page look pending again.
  const inspectionStatus: PreDiagnosticRound['status'] | undefined =
    jobOrder?.stage === 'inspecting' ? preDiagnostic?.status : 'approved'
  const isApproved = inspectionStatus === 'approved'
  const isLocked = inspectionStatus === 'pending' || isApproved

  // Auto-refresh while waiting on the customer's decision, so the admin sees
  // "Approved" / "Customer has concerns" without having to reload the page.
  useEffect(() => {
    if (inspectionStatus !== 'pending') return
    const interval = setInterval(() => {
      getLatestPreDiagnostic(jobOrderId).then(setPreDiagnostic)
    }, 5000)
    return () => clearInterval(interval)
  }, [inspectionStatus, jobOrderId])

  // Once the real data arrives, seed the editable state from it.
  useEffect(() => {
    if (initial) {
      setPhotoSlots(initial.photoSlots)
      setFindings(initial.findings)
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

    const slot = photoSlots.find((p) => p.id === slotId)
    const previousUrl = slot?.url
    const localUrl = URL.createObjectURL(file)
    setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url: localUrl } : p)))
    setUploadingSlot(slotId)

    setSaveState('saving')
    try {
      const compressed = await compressImage(file)
      const currentTitle = slot?.title || slot?.label || label
      const uploaded = await uploadInspectionPhoto(jobOrderId, slotId, label, compressed, currentTitle, slot?.rowId)
      if (!uploaded) throw new Error('upload rejected')
      setPhotoSlots((prev) =>
        prev.map((p) =>
          p.id === slotId
            ? { ...p, url: uploaded.url, rowId: uploaded.rowId }
            : p,
        ),
      )
      toast.success(`${currentTitle} photo saved`)
      setSaveState('saved')
    } catch {
      setPhotoSlots((prev) => prev.map((p) => (p.id === slotId ? { ...p, url: previousUrl } : p)))
      toast.error(`Could not save the ${label} photo. Please try again.`)
      setSaveState('error')
    } finally {
      URL.revokeObjectURL(localUrl)
      setUploadingSlot(null)
    }
  }

  // Title saves on blur when the photo has already been uploaded.
  async function persistSlotTitle(slot: InspectionPhotoSlot) {
    if (isLocked || !slot.rowId) return
    const titleToSave = (slot.title ?? slot.label ?? '').trim()
    if (!titleToSave) return
    setSaveState('saving')
    const ok = await saveWalkaroundTitle(jobOrderId, slot.rowId, titleToSave)
    if (!ok) {
      toast.error(`Could not save the photo title. Please try again.`)
      setSaveState('error')
      return
    }
    setHasUnsavedChanges(false)
    setSaveState('saved')
  }

  // Condition notes save on blur — one photo, one note, no separate Save button
  // to forget. Needs a row to write to, so a photo must be uploaded first.
  async function persistSlotNote(slot: InspectionPhotoSlot) {
    if (isLocked || !slot.rowId) return
    setSaveState('saving')
    const ok = await saveWalkaroundNote(jobOrderId, slot.rowId, slot.note ?? '')
    if (!ok) {
      toast.error(`Could not save the ${slot.title || slot.label} note. Please try again.`)
      setSaveState('error')
      return
    }
    setHasUnsavedChanges(false)
    setSaveState('saved')
  }

  async function handlePhotoDelete(slot: InspectionPhotoSlot) {
    if (isLocked) return
    if (slot.rowId) {
      setSaveState('saving')
      const ok = await deleteInspectionPhoto(jobOrderId, slot.rowId)
      if (!ok) {
        toast.error('Could not delete photo. Please try again.')
        setSaveState('error')
        return
      }
      toast.success('Photo removed')
      setSaveState('saved')
    }

    if (slot.id.startsWith('custom-')) {
      setPhotoSlots((prev) => prev.filter((p) => p.id !== slot.id))
    } else {
      setPhotoSlots((prev) =>
        prev.map((p) =>
          p.id === slot.id
            ? { ...p, url: undefined, rowId: undefined, note: '' }
            : p,
        ),
      )
    }
  }

  function addPhotoSlot() {
    if (isLocked) return
    const newSlotId = `custom-${Date.now()}`
    setPhotoSlots((prev) => [
      ...prev,
      { id: newSlotId, label: 'Inspection Photo', title: 'Inspection Photo' },
    ])
  }

  function removeCustomSlot(slotId: string) {
    if (isLocked) return
    setPhotoSlots((prev) => prev.filter((p) => p.id !== slotId))
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

    setSaveState('saving')
    const ok = await updateInspectionFinding(jobOrderId, { id: fId, name, note, status })
    setSaveState(ok ? 'saved' : 'error')
  }

  async function deleteFinding(fId: string) {
    if (isLocked) return
    // Optimistic update
    setFindings((prev) => prev.filter((f) => f.id !== fId))

    // API Call
    setSaveState('saving')
    const ok = await deleteInspectionFinding(jobOrderId, fId)
    setSaveState(ok ? 'saved' : 'error')
  }

  async function addFinding() {
    if (isLocked || editingFindingId !== null) return
    const newFindingData = {
      name: '',
      note: '',
      status: 'ok' as FindingStatus,
    }

    // API Call to get real ID
    setSaveState('saving')
    const added = await addInspectionFinding(jobOrderId, newFindingData)
    setSaveState(added ? 'saved' : 'error')
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
  async function askToUseScanner() {
    if (!jobOrder) return
    setRequestingScan(true)
    const result = await requestScanAuthorization(jobOrderId, '')
    setRequestingScan(false)
    if (!result.ok) {
      toast.error(result.message ?? 'Could not send the request.')
      return
    }
    toast.success("Sent — the customer needs to approve the scan fee before you can attach a report.")
    // Re-fetch so the banner switches to "waiting on customer" immediately.
    const data = await getInspectionById(jobOrderId)
    if (data) setInitial(data)
  }

    async function sendInspectionForApproval() {
    // Exception 1 (paper, Manage Real-Time Progress): the report can't go
    // out without photo evidence of the vehicle's condition — that's what
    // protects the shop and the customer if the car's state is disputed
    // later. An empty gallery or an empty slot both count as missing.
    const missingPhotos = photoSlots.length === 0 || photoSlots.some((slot) => !slot.url)
    if (missingPhotos) {
      setShowPhotoWarning(true)
      toast.error('Please upload all intake photos to complete the pre-assessment condition report.')
      return
    }
    setShowPhotoWarning(false)

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
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
      <TopBar title="Vehicle Inspection" subtitle="Inspection workflow & time tracking." showSearch={false} />
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
            <div className="flex items-center gap-3">
              {/* Passive save indicator — every field auto-saves on its own,
                  this just says whether the server has what's on screen. */}
              {!isLocked && (
                saveState === 'error' ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                    <AlertCircle size={13} /> Couldn't save
                  </span>
                ) : saveState === 'saving' ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Loader2 size={13} className="animate-spin" /> Saving…
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Check size={13} className="text-emerald-500" /> Saved
                  </span>
                )
              )}
              <button
                onClick={sendInspectionForApproval}
                disabled={sending || isLocked}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-default disabled:bg-emerald-600"
              >
                {inspectionStatus === 'disputed' ? (
                    <AlertCircle size={15} />
                  ) : inspectionStatus ? (
                  <CheckCircle2 size={15} />
                  ) : (
                  <Cloud size={15} />
                  )}
                {sending
                  ? 'Sending…'
                  : inspectionStatus === 'pending'
                  ? 'Awaiting customer approval'
                  : inspectionStatus === 'approved'
                  ? 'Approved by customer'
                  : inspectionStatus === 'disputed'
                  ? 'Customer has concerns - revise and send again'
                  : 'Upload to customer portal'}
              </button>
            </div>
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
            ) : initial.scanAuthorization?.decision === 'pending' ? (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <Loader2 size={16} className="flex-shrink-0 animate-spin" />
                <span>
                  <b>Waiting on the customer.</b> They were notified to approve the{' '}
                  {formatPeso(DIAGNOSTIC_SCAN_FEE)} scan fee. You can attach a report once they approve.
                </span>
              </div>
            ) : (
              // The customer was never asked about the scanner at booking (only
              // 2 of 8 categories ask, and "Others" never does), or they were
              // asked mid-inspection and said no. Either way, don't plug the
              // scanner in without a fresh yes — ask again from here.
              <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2.5">
                  <Info size={16} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {initial.scanAuthorization?.decision === 'disputed' ? (
                      <><b>Customer declined</b> the scan request. You can ask again.</>
                    ) : (
                      <><b>Heads up:</b> the customer wasn&apos;t told about the {formatPeso(DIAGNOSTIC_SCAN_FEE)} scanner fee when they booked.</>
                    )}{' '}
                    Using the scanner needs their approval first.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={askToUseScanner}
                  disabled={requestingScan || isLocked}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requestingScan ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                  {initial.scanAuthorization?.decision === 'disputed' ? 'Ask Again' : 'Use Scanner'}
                </button>
              </div>
            )}

            {inspectionStatus === 'pending' && (
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

            {inspectionStatus === 'disputed' && preDiagnostic && (
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

            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Inspection Photos</p>
                <p className="text-xs text-slate-500">Walkaround condition photos and reference views</p>
                {showPhotoWarning && (photoSlots.length === 0 || photoSlots.some((s) => !s.url)) && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-600">
                    <AlertCircle size={12} /> Please upload all intake photos to complete the pre-assessment condition report.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={addPhotoSlot}
                disabled={isLocked}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                <Plus size={13} /> Add Photo
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {photoSlots.map((slot) => (
                <div key={slot.id} className="flex flex-col gap-2">
                  <div
                    className={`group relative h-40 overflow-hidden rounded-xl border-2 border-dashed bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400 ${
                      showPhotoWarning && !slot.url
                        ? 'border-rose-400 bg-rose-50 hover:border-rose-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {slot.url ? (
                      <>
                        {/* The photo opens the viewer; replacing it is a separate
                            control, since one click can't mean both. */}
                        <button
                          type="button"
                          onClick={() => setLightbox({ url: slot.url!, label: slot.title || slot.label })}
                          className="absolute inset-0 h-full w-full"
                        >
                          <img src={slot.url} alt={slot.title || slot.label} className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 text-white opacity-0 group-hover:opacity-100">
                            <Maximize2 size={14} /> View
                          </span>
                        </button>
                        {!isLocked && (
                          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 opacity-0 shadow group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[slot.id]?.click()}
                              disabled={uploadingSlot === slot.id}
                              className="rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-white"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(slot)}
                              className="rounded-md bg-white/90 p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              title="Delete photo"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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
                      </button>
                    )}
                    {uploadingSlot === slot.id && (
                      <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 text-white">
                        <Loader2 size={16} className="animate-spin" /> Uploading…
                      </span>
                    )}
                    {slot.id.startsWith('custom-') && !slot.rowId && !isLocked && (
                      <button
                        type="button"
                        onClick={() => removeCustomSlot(slot.id)}
                        className="absolute top-2 right-2 z-10 rounded-md bg-white/80 p-1 text-slate-400 hover:bg-white hover:text-rose-500"
                        title="Remove photo slot"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <input
                      ref={(el) => { fileInputRefs.current[slot.id] = el }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        handlePhotoPick(slot.id, slot.title || slot.label, e.target.files?.[0])
                        e.target.value = '' // re-picking the same file still fires onChange
                      }}
                    />
                  </div>

                  <input
                    type="text"
                    value={slot.title ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setPhotoSlots((prev) =>
                        prev.map((p) => (p.id === slot.id ? { ...p, title: val, label: val } : p))
                      )
                      setHasUnsavedChanges(true)
                    }}
                    onBlur={() => persistSlotTitle(slot)}
                    disabled={isLocked}
                    placeholder={slot.label ? `e.g. ${slot.label}` : 'Photo title (e.g. Front Quarter)'}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                  />

                  <textarea
                    value={slot.note ?? ''}
                    onChange={(e) => {
                      setPhotoSlots((prev) => prev.map((p) => (p.id === slot.id ? { ...p, note: e.target.value } : p)))
                      setHasUnsavedChanges(true)
                    }}
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

            {/* What each level means — the mechanic shouldn't have to guess. */}
            <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
              {(['ok', 'needs-attention', 'urgent'] as FindingStatus[]).map((s) => (
                <div key={s}>
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${findingStatusMeta[s].classes}`}>
                    {findingStatusMeta[s].label}
                  </span>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{findingStatusMeta[s].meaning}</p>
                </div>
              ))}
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
                                title={`${findingStatusMeta[s].meaning} ${findingStatusMeta[s].action}`}
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

          {/* ── OBD-II Diagnostic Report ─────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                  <ScanLine size={16} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">OBD-II Diagnostic Report</p>
                  <p className="text-xs text-slate-400">Scanner findings from LAUNCH X-431 or compatible tools</p>
                </div>
              </div>
              {obd2Report && (
                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => setShowRemoveDialog(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors active:scale-95"
                      title="Detach this report from the job order"
                    >
                      <Link2 size={13} className="text-slate-500" />
                      Detach Report
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDtcs((v) => !v)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    {showDtcs ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showDtcs ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              )}
            </div>

            {/* Loading state */}
            {obd2Report === undefined && (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin" /> Loading diagnostic data…
              </div>
            )}

            {/* No report linked yet */}
            {obd2Report === null && !showPicker && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">No OBD-II report attached</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {initial.diagnosticScanAuthorized
                    ? 'Attach an existing report or upload a scanner PDF directly.'
                    : "Get the customer’s approval above before using the scanner."}
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={openPicker}
                    disabled={!initial.diagnosticScanAuthorized}
                    title={!initial.diagnosticScanAuthorized ? 'The customer needs to approve the scan fee first' : undefined}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-900 disabled:active:scale-100"
                  >
                    <Link2 size={13} /> Attach Report
                  </button>
                  <label
                    title={!initial.diagnosticScanAuthorized ? 'The customer needs to approve the scan fee first' : undefined}
                    className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 ${
                      initial.diagnosticScanAuthorized ? 'cursor-pointer hover:bg-slate-100 active:scale-95' : 'cursor-not-allowed opacity-40'
                    }`}
                  >
                    {uploadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {uploadingPdf ? 'Uploading…' : 'Upload PDF'}
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={!initial.diagnosticScanAuthorized}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePdfUpload(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Unlinked reports picker */}
            {obd2Report === null && showPicker && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">Select a stored report to attach:</p>
                  <button onClick={() => setShowPicker(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
                {pickerLoading && (
                  <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                    <Loader2 size={14} className="animate-spin" /> Loading reports…
                  </div>
                )}
                {!pickerLoading && unlinkedReports.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                    <p className="text-sm text-slate-400">No unlinked diagnostic reports found.</p>
                    <p className="mt-1 text-xs text-slate-400">Use "Sync Gmail" in the admin panel or upload a PDF below.</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                      {uploadingPdf ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                      {uploadingPdf ? 'Uploading…' : 'Upload PDF'}
                      <input
                        type="file" accept="application/pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); e.target.value = '' }}
                      />
                    </label>
                  </div>
                )}
                {!pickerLoading && unlinkedReports.length > 0 && (
                  <div className="space-y-2">
                    {unlinkedReports.map((r) => {
                      const vehicleName = [r.reported_make, r.reported_model].filter(Boolean).join(' ')
                      const title = vehicleName
                        ? `${vehicleName}${r.reported_year ? ` (${r.reported_year})` : ''}`
                        : (r.filename ?? 'Diagnostic Report')

                      return (
                        <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-slate-800">{title}</p>
                              {r.reported_vin ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-600">
                                  VIN: {r.reported_vin}
                                </span>
                              ) : (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                                  No VIN
                                </span>
                              )}
                              {r.reported_plate && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                  {r.reported_plate}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {r.filename && vehicleName ? `${r.filename} · ` : ''}
                              {r.scanner_tool ?? 'Scanner'}
                              {r.report_date ? ` · ${new Date(r.report_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                              {' · '}{r.dtc_count} DTC{r.dtc_count !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => linkReport(r.id)}
                              disabled={linkingId === r.id || deletingUnlinked}
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 active:scale-95 transition-colors"
                            >
                              {linkingId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                              Attach
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteUnlinkedTarget(r)}
                              disabled={linkingId === r.id || deletingUnlinked}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 transition-colors active:scale-95"
                              title="Remove diagnostic report from system"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Linked report — display card + DTC table */}
            {obd2Report && showDtcs && (
              <div className="space-y-4">
                {/* Report header info */}
                <div className="grid grid-cols-3 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs">
                  <div>
                    <p className="text-slate-400">Scanner</p>
                    <p className="font-semibold text-slate-800">{obd2Report.scanner_tool ?? '—'}</p>
                    {obd2Report.scanner_software && <p className="text-slate-400">{obd2Report.scanner_software}</p>}
                  </div>
                  <div>
                    <p className="text-slate-400">Report Date</p>
                    <p className="font-semibold text-slate-800">
                      {obd2Report.report_date
                        ? new Date(obd2Report.report_date).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Vehicle (Scanner)</p>
                    <p className="font-semibold text-slate-800">
                      {[obd2Report.reported_make, obd2Report.reported_model, obd2Report.reported_year].filter(Boolean).join(' ') || obd2Report.filename || '—'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {obd2Report.reported_vin ? (
                        <span className="font-mono text-[10px] text-slate-500">VIN: {obd2Report.reported_vin}</span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-medium">No VIN</span>
                      )}
                      {obd2Report.reported_engine && <span className="text-slate-400">· {obd2Report.reported_engine}</span>}
                    </div>
                  </div>
                  {obd2Report.test_mileage && (
                    <div>
                      <p className="text-slate-400">Mileage at Scan</p>
                      <p className="font-semibold text-slate-800">{obd2Report.test_mileage.toLocaleString()} km</p>
                    </div>
                  )}
                  {obd2Report.pdf_storage_url && (
                    <div>
                      <p className="text-slate-400">Original PDF</p>
                      <a href={obd2Report.pdf_storage_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 font-semibold text-indigo-600 hover:underline">
                        <FileText size={11} /> View PDF
                      </a>
                    </div>
                  )}
                  {obd2Report.linked_by_name && (
                    <div>
                      <p className="text-slate-400">Linked by</p>
                      <p className="font-semibold text-slate-800">{obd2Report.linked_by_name}</p>
                      {obd2Report.linked_at && (
                        <p className="text-slate-400">{new Date(obd2Report.linked_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* DTC codes table */}
                {obd2Dtcs.length === 0 ? (
                  <p className="text-sm text-slate-400">No DTC codes were extracted from this report.</p>
                ) : (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">Diagnostic Trouble Codes ({obd2Dtcs.length})</p>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500">Code</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500">Description</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500">State</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500">System</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {obd2Dtcs.map((dtc) => {
                            const stateLower = (dtc.dtc_state ?? '').toLowerCase()
                            const stateClass =
                              stateLower === 'current'
                                ? 'bg-rose-100 text-rose-700'
                                : stateLower === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            return (
                              <tr key={dtc.dtc_id} className="bg-white hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <span className="font-mono font-bold text-slate-900">{dtc.dtc_code}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-700">{dtc.dtc_description ?? '—'}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateClass}`}>
                                    {dtc.dtc_state ?? '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{dtc.dtc_system ?? '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
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

      {showRemoveDialog && obd2Report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Detach Diagnostic Report?</h3>
                <p className="text-xs text-slate-500">
                  {[obd2Report.reported_make, obd2Report.reported_model, obd2Report.reported_year].filter(Boolean).join(' ') || obd2Report.filename || 'Diagnostic Report'}
                  {obd2Report.reported_vin ? ` · VIN: ${obd2Report.reported_vin}` : ''}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              If this is the wrong report for this vehicle, detaching will remove it from this Job Order. The report and its DTC codes will remain safely stored in the system so you can assign it to another vehicle.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={unlinking}
                onClick={() => setShowRemoveDialog(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={unlinking}
                onClick={handleDetachReport}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-colors active:scale-95"
              >
                {unlinking ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                Detach from this Job Order
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUnlinkedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Diagnostic Report?</h3>
                <p className="text-xs text-slate-500">
                  {[deleteUnlinkedTarget.reported_make, deleteUnlinkedTarget.reported_model, deleteUnlinkedTarget.reported_year].filter(Boolean).join(' ') || deleteUnlinkedTarget.filename || 'Diagnostic Report'}
                  {deleteUnlinkedTarget.reported_vin ? ` · VIN: ${deleteUnlinkedTarget.reported_vin}` : ''}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently remove this report from the system? This will delete the report and its {deleteUnlinkedTarget.dtc_count} DTC error code{deleteUnlinkedTarget.dtc_count !== 1 ? 's' : ''} from the database. This action cannot be undone.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deletingUnlinked}
                onClick={() => setDeleteUnlinkedTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deletingUnlinked}
                onClick={() => handleDeleteUnlinkedReport(deleteUnlinkedTarget.id)}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors active:scale-95"
              >
                {deletingUnlinked ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Remove Report
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}