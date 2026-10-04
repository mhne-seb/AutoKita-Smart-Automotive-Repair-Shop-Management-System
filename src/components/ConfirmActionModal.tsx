import { useEffect } from 'react'
import { Trash2, Store, AlertCircle, X } from 'lucide-react'

interface ConfirmActionModalProps {
  tone: 'danger' | 'default' | 'brand'
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmActionModal({
  tone,
  title,
  description,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: ConfirmActionModalProps) {
  const isDanger = tone === 'danger'
  const isBrand = tone === 'brand'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [busy, onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              isDanger
                ? 'bg-destructive/10 text-destructive'
                : isBrand
                ? 'bg-brand/10 text-brand'
                : 'bg-accent text-foreground'
            }`}
          >
            {isDanger ? <Trash2 size={20} /> : isBrand ? <Store size={20} /> : <AlertCircle size={20} />}
          </div>
          <button
            onClick={() => {
              if (!busy) onClose()
            }}
            disabled={busy}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => {
              if (!busy) onClose()
            }}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
              isDanger
                ? 'bg-destructive text-destructive-foreground hover:opacity-90'
                : isBrand
                ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white hover:opacity-90'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
