import { useState } from 'react'
import { X } from 'lucide-react'

export function RejectPaymentModal({
  onClose,
  onConfirm,
  isWorking
}: {
  onClose: () => void
  onConfirm: (reason: string) => void
  isWorking: boolean
}) {
  const [rejectReason, setRejectReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Reject Payment</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Reason for Rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the payment was rejected (e.g. proof unreadable, amount mismatch)"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-rose-500"
              rows={4}
              autoFocus
            />
            <p className="mt-1 flex justify-between text-xs text-slate-400">
              <span>Must be between 3 and 200 characters.</span>
              <span>{rejectReason.length}/200</span>
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => onConfirm(rejectReason.trim())}
            disabled={rejectReason.trim().length < 3 || rejectReason.length > 200 || isWorking}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-150 hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {isWorking ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
