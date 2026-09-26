'use client'

// WarrantyClaimCard — sits at the top of the inspection page for a job order
// that started from a customer's warranty claim. The mechanic's finding is
// the evidence for the admin's decision: approve (part + labor go on this
// job order at ₱0) or deny (with a reason, and whether it voids the warranty).

import { useState } from 'react'
import { ShieldCheck, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { decideWarrantyClaim, type WarrantyClaim } from '@/controllers/warrantyClaimController'

export function WarrantyClaimCard({
  claim,
  jobOrderId,
  onDecided,
}: {
  claim: WarrantyClaim
  jobOrderId: string
  onDecided: () => void | Promise<void>
}) {
  const [finding, setFinding] = useState('')
  const [denyReason, setDenyReason] = useState<'misuse' | 'not_covered'>('misuse')
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null)

  const daysLeft = Math.max(0, Math.round((new Date(claim.expirationDate).getTime() - Date.now()) / 86400000))
  const expired = daysLeft <= 0

  async function approve() {
    setBusy('approve')
    const r = await decideWarrantyClaim(jobOrderId, { action: 'approve', mechanicFinding: finding })
    setBusy(null)
    if (!r.ok) return toast.error(r.message ?? 'Could not approve the claim.')
    toast.success('Claim approved — part and labor added at ₱0.')
    await onDecided()
  }

  async function deny() {
    setBusy('deny')
    const r = await decideWarrantyClaim(jobOrderId, {
      action: 'deny',
      mechanicFinding: finding,
      denyReason: denyReason === 'misuse' ? 'Misuse or accident' : 'Not a covered defect',
      voidsWarranty: denyReason === 'misuse',
    })
    setBusy(null)
    if (!r.ok) return toast.error(r.message ?? 'Could not deny the claim.')
    toast.success('Claim denied — this job order continues as a paid repair.')
    await onDecided()
  }

  if (claim.decision !== 'pending') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ShieldCheck size={16} className="text-brand" /> Warranty claim · {claim.coverageDescription}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {claim.decision === 'approved'
            ? 'Approved — part and labor were added at ₱0.'
            : `Denied${claim.denyReason ? ` — ${claim.denyReason}` : ''}.`}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand-soft/20 p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ShieldCheck size={16} className="text-brand" /> Warranty claim · JO-{claim.originalJobOrderId}
        </p>
        <span className="rounded-full bg-warning/20 px-2.5 py-1 text-[11px] font-semibold text-warning">Awaiting decision</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-slate-400">Part</div>
          <div className="font-medium text-slate-900">{claim.coverageDescription}</div>
        </div>
        <div>
          <div className="text-slate-400">Covered until</div>
          <div className="font-medium text-slate-900">{new Date(claim.expirationDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div className="col-span-2">
          <div className="text-slate-400">Customer says</div>
          <div className="font-medium text-slate-900">{claim.customerDescription}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!expired && (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-semibold text-success">
            <Check size={11} /> Not expired · {daysLeft} days left
          </span>
        )}
        {expired && (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive">
            <X size={11} /> Expired
          </span>
        )}
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold text-slate-700">Mechanic's finding</label>
        <textarea
          value={finding}
          onChange={(e) => setFinding(e.target.value)}
          rows={2}
          placeholder="What did you find when you inspected the part?"
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={approve}
          disabled={busy !== null || !finding.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve · ₱0 replacement
        </button>
        <button
          onClick={deny}
          disabled={busy !== null || !finding.trim()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deny claim
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3">
        <div className="mb-1.5 text-[11px] font-semibold text-slate-500">If denied</div>
        <select
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value as 'misuse' | 'not_covered')}
          className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
        >
          <option value="misuse">Misuse or accident — voids the warranty</option>
          <option value="not_covered">Not a covered defect — warranty stays active</option>
        </select>
      </div>
    </div>
  )
}
