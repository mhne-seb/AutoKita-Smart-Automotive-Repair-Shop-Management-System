'use client'


import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Gauge, Play, CheckCircle2, XCircle, Camera, Loader2, ArrowLeft, ArrowRight, Wrench, Package, History, AlertTriangle, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { JobOrderBreadcrumb } from '@/components/dashboard/JobOrderBreadcrumb'
import { Lightbox } from '@/components/Lightbox'
import { getJobOrderById } from '@/controllers/jobOrderController'
import { getRoadTestData, startRoadTest, passRoadTest, failRoadTest, type RoadTestData } from '@/controllers/roadTestController'
import { isDiagnosticScanTask } from '@/data/diagnosticScan'
import type { JobOrderCard } from '@/data/types'
import { ConfirmActionModal } from '@/components/ConfirmActionModal'

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export default function TestingPage() {
  const params = useParams()
  const jobOrderId = String(params.id)

  const [jobOrder, setJobOrder] = useState<JobOrderCard | null | undefined>(undefined)
  const [data, setData] = useState<RoadTestData | null>(null)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)

  // Start
  const [testerId, setTesterId] = useState<number | ''>('')
  const [starting, setStarting] = useState(false)
  // Result form (shown while a test is out)
  const [verdict, setVerdict] = useState<'pass' | 'fail' | null>(null)
  const [notes, setNotes] = useState('')
  const [rework, setRework] = useState<Set<number>>(new Set())
  const [failedParts, setFailedParts] = useState<Set<number>>(new Set())
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmSubmitResult, setConfirmSubmitResult] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [jo, rt] = await Promise.all([getJobOrderById(jobOrderId), getRoadTestData(jobOrderId)])
    setJobOrder(jo)
    setData(rt)
  }
  useEffect(() => { load() }, [jobOrderId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    e.target.value = '' // re-picking the same file still fires onChange
    if (f && f.size > 5 * 1024 * 1024) return toast.error('Photo must be under 5MB.')
    setPhoto(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }
  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    setter(next)
  }

  async function onStart() {
    setStarting(true)
    const r = await startRoadTest(jobOrderId, Number(testerId))
    setStarting(false)
    if (!r.ok) return toast.error(r.message)
    toast.success('Road test started — the customer has been notified.')
    await load()
  }

  function tasksRequiredByFailedParts(data: RoadTestData, failed: Set<number>): Set<number> {
    const requiredTitles = new Set(data.parts.filter((p) => failed.has(p.id)).map((p) => p.service_name))
    return new Set(data.tasks.filter((t) => requiredTitles.has(t.task_title)).map((t) => t.id))
  }

  async function onSubmitResult() {
    setSaving(true)
    const effectiveRework = data ? new Set([...rework, ...tasksRequiredByFailedParts(data, failedParts)]) : rework
    const r = verdict === 'pass'
      ? await passRoadTest(jobOrderId, notes.trim(), photo)
      : await failRoadTest(jobOrderId, notes.trim(), [...effectiveRework], [...failedParts], photo)
    setSaving(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(verdict === 'pass' ? 'Passed — job order is now Completed.' : 'Recorded — the ticked services are back on the floor.')
    setVerdict(null); setNotes(''); setRework(new Set()); setFailedParts(new Set()); setPhoto(null); setPreview(null)
    await load()
  }

  if (jobOrder === undefined || !data) {
    return <div className="p-8 text-sm text-slate-400">Loading…</div>
  }
  if (!jobOrder) {
    return <div className="p-8 text-sm text-slate-400">Job order not found.</div>
  }

  const current = data.current
  const passed = data.history.some((a) => a.result === 'pass')
  const attemptNo = data.history.length + 1
  const canStart = data.status === 'in_progress' && data.allServicesDone && !current && !passed

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-8">
      <TopBar title="Testing" subtitle="Road test before the vehicle goes back to the customer." showSearch={false} />
      <JobOrderBreadcrumb jobOrderId={jobOrderId} current="testing" stage={jobOrder.stage} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 sm:gap-6">
          <div><p className="text-slate-400">Vehicle</p><p className="font-bold text-slate-900">{jobOrder.vehicle}</p></div>
          <div><p className="text-slate-400">Plate No.</p><p className="font-bold text-slate-900">{jobOrder.plate}</p></div>
          <div><p className="text-slate-400">Customer</p><p className="font-bold text-slate-900">{jobOrder.customer}</p></div>
          <div className="sm:text-right"><p className="text-slate-400">Job Order</p><span className="inline-block rounded bg-slate-900 px-2 py-1 text-xs font-bold text-white">JO-{jobOrderId}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* ---- State card: start / in progress / passed ---- */}
          {passed ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6">
              <p className="flex items-center gap-2 text-lg font-bold text-emerald-800"><CheckCircle2 size={22} /> Road test passed</p>
              <p className="mt-1 text-sm text-emerald-800/80">The job order is complete. Collect the balance and release the vehicle on the Billing page.</p>
              <Link href={`/job-orders/${jobOrderId}/billing`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Proceed to Billing <ArrowRight size={14} /></Link>
            </div>
          ) : current ? (
            <div className="rounded-2xl border border-sky-300 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-lg font-bold text-slate-900"><Gauge size={22} className="text-sky-600" /> Attempt {current.attemptNo} — out on the road</p>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Started {fmt(current.startedAt)} · {current.testerName}</span>
              </div>

              {/* Verdict */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setVerdict('pass')} className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${verdict === 'pass' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md`}>
                  <CheckCircle2 size={18} /> Pass — repairs hold up
                </button>
                <button type="button" onClick={() => setVerdict('fail')} className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${verdict === 'fail' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md`}>
                  <XCircle size={18} /> Fail — something's still wrong
                </button>
              </div>

              {verdict && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">{verdict === 'pass' ? 'Notes (optional)' : 'What failed?'}</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                      placeholder={verdict === 'pass' ? 'Brakes firm, no pull, no noise at 60 km/h…' : 'Still pulls left under braking; grinding from the rear on the second stop…'}
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-sky-500" />
                  </div>

                  {verdict === 'fail' && (
                    <>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-slate-700">Services to redo <span className="font-normal text-slate-400">— these go back to the floor</span></p>
                        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                          {/* The scan already happened during inspection, before the
                              car ever went out on this road test — a test drive can't
                              prove a diagnostic reading right or wrong, so it can't be
                              one of the things that "failed" it. */}
                          {data.tasks.filter((t) => !isDiagnosticScanTask(t)).map((t) => {
                            // A part can't be swapped in without touching its
                            // service again, so ticking a failed part below
                            // locks its service here on — it isn't optional.
                            const requiredByPart = data.parts.some((p) => failedParts.has(p.id) && p.service_name === t.task_title)
                            return (
                            <label key={t.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${requiredByPart ? 'cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                              <input
                                type="checkbox"
                                checked={rework.has(t.id) || requiredByPart}
                                disabled={requiredByPart}
                                onChange={() => toggle(rework, t.id, setRework)}
                                className="h-4 w-4 accent-rose-500"
                              />
                              <Wrench size={14} className="text-slate-400" />
                              <span className="flex-1">{t.task_title}</span>
                              {requiredByPart && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Required — a part below failed</span>}
                              {t.rework_count > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Redone ×{t.rework_count}</span>}
                            </label>
                            )
                          })}
                        </div>
                      </div>
                      {data.parts.length > 0 && (
                        <div>
                          <p className="mb-1 text-sm font-semibold text-slate-700">Parts that failed <span className="font-normal text-slate-400">— replaced under warranty at no charge to the customer</span></p>
                          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                            {data.parts.map((p) => (
                              <label key={p.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                                <input type="checkbox" checked={failedParts.has(p.id)} onChange={() => toggle(failedParts, p.id, setFailedParts)} className="h-4 w-4 accent-rose-500" />
                                <Package size={14} className="text-slate-400" />
                                <span className="flex-1">{p.description} <span className="text-xs text-slate-400">· {p.part_number || '—'} · ×{p.quantity} · {p.service_name}</span></span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Found something new that the customer would have to pay for? Record the fail first, then use <b>Report a finding</b> on Service Progress — it goes to the customer for approval like any other addition.
                      </p>
                    </>
                  )}

                  <div className="flex items-center gap-3">
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={pickPhoto} />
                    <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
                    {/* capture="environment" only means anything on a touch
                        device with a camera (phone OR tablet) — gate on
                        pointer type, not screen width, since a tablet is wide
                        but still has a working camera. */}
                    <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 [@media(pointer:fine)]:hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">
                      <Camera size={13} /> {photo ? 'Retake' : 'Take Photo'}
                    </button>
                    <button type="button" onClick={() => galleryRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">
                      <Upload size={13} />
                      <span className="[@media(pointer:fine)]:hidden">Gallery</span>
                      <span className="hidden [@media(pointer:fine)]:inline">{photo ? 'Replace photo' : 'Add photo'}</span>
                    </button>
                    {preview && <img src={preview} alt="" className="h-12 w-16 rounded-md border object-cover" />}
                    <span className="text-xs text-slate-400">Optional — dashboard, odometer, or the fault</span>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => setVerdict(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Cancel</button>
                    <button type="button" onClick={() => {
                      if (!verdict) return
                      setConfirmSubmitResult(true)
                    }} disabled={saving}
                      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50 ${verdict === 'pass' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : verdict === 'pass' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                      {verdict === 'pass' ? 'Mark passed & complete job' : 'Record fail & send back to floor'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="flex items-center gap-2 text-lg font-bold text-slate-900"><Gauge size={22} className="text-sky-600" /> {attemptNo > 1 ? `Road test — attempt ${attemptNo}` : 'Road test'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {data.allServicesDone
                  ? 'Every service is finished. Pick who drives, then start the test.'
                  : 'The road test unlocks once every service on this job is finished.'}
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Tester</label>
                  <select value={testerId} onChange={(e) => setTesterId(e.target.value ? Number(e.target.value) : '')} disabled={!canStart}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-sky-500 disabled:bg-slate-50">
                    <option value="">Select a mechanic…</option>
                    {data.mechanics.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => {
                  if (!testerId) return toast.error('Pick who is driving the test.')
                  setConfirmStart(true)
                }} disabled={!canStart || starting}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md hover:bg-sky-700 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-40">
                  {starting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start road test
                </button>
              </div>
              {!data.allServicesDone && (
                <Link href={`/job-orders/${jobOrderId}/progress`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><ArrowLeft size={14} /> Back to Service Progress</Link>
              )}
            </div>
          )}

          {/* ---- Attempt history ---- */}
          {data.history.length > 0 && (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500"><History size={14} /> Attempts</p>
              {data.history.map((a) => (
                <div key={a.id} className={`rounded-xl border p-4 ${a.result === 'pass' ? 'border-emerald-200 bg-emerald-50/40' : a.result === 'fail' ? 'border-rose-200 bg-rose-50/40' : 'border-sky-200 bg-sky-50/40'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">Attempt {a.attemptNo} <span className="font-normal text-slate-400">· {a.testerName}</span></p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.result === 'pass' ? 'bg-emerald-100 text-emerald-700' : a.result === 'fail' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                      {a.result === 'pass' ? 'Passed' : a.result === 'fail' ? 'Failed' : 'In progress'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Started {fmt(a.startedAt)}{a.endedAt ? ` · Ended ${fmt(a.endedAt)}` : ''}</p>
                  {a.notes && <p className="mt-2 text-sm text-slate-700">{a.notes}</p>}
                  {a.result === 'fail' && (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      {a.reworkTaskTitles.length > 0 && <p><span className="font-semibold">Sent back:</span> {a.reworkTaskTitles.join(', ')}</p>}
                      {a.failedPartNames.length > 0 && <p><span className="font-semibold">Warranty parts:</span> {a.failedPartNames.join(', ')}</p>}
                    </div>
                  )}
                  {a.photoUrl && (
                    <button type="button" onClick={() => setLightbox({ url: a.photoUrl!, label: `Road test attempt ${a.attemptNo}` })} className="mt-2 block overflow-hidden rounded-md border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">
                      <img src={a.photoUrl} alt="" className="h-16 w-24 object-cover" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Sidebar: what's being tested ---- */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Wrench size={13} /> Services on this job</p>
            <ul className="space-y-1.5 text-sm">
              {data.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">{t.task_title}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.task_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.task_status === 'completed' ? 'Done' : 'Open'}
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`/job-orders/${jobOrderId}/progress`} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"><ArrowLeft size={12} /> Service Progress</Link>
          </div>
        </div>
      </div>

      {lightbox && <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />}
      
      {confirmStart && (
        <ConfirmActionModal
          tone="brand"
          title="Start the road test?"
          description="The job order moves to Testing. Pick the driver first."
          confirmLabel="Start road test"
          busy={starting}
          onClose={() => setConfirmStart(false)}
          onConfirm={async () => {
            await onStart()
            setConfirmStart(false)
          }}
        />
      )}
      
      {confirmSubmitResult && verdict && (
        <ConfirmActionModal
          tone={verdict === 'pass' ? 'brand' : 'danger'}
          title={verdict === 'pass' ? 'Mark the road test as passed?' : 'Record the road test as failed?'}
          description={verdict === 'pass' ? 'The job order becomes Completed and the customer is notified.' : 'The ticked services go back to the floor for rework.'}
          confirmLabel={verdict === 'pass' ? 'Mark as passed' : 'Record as failed'}
          busy={saving}
          onClose={() => setConfirmSubmitResult(false)}
          onConfirm={async () => {
            await onSubmitResult()
            setConfirmSubmitResult(false)
          }}
        />
      )}
    </div>
  )
}
