'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { BookingPage } from '@/components/dashboard/BookingPage'

// The booking form shown over the current page. Same component as /dashboard/book.
// It does not close on a backdrop click; closing with something picked asks first.
export function BookingModal({
  initialVehicleId,
  onClose,
  onBooked,
}: {
  initialVehicleId?: string
  onClose: () => void
  onBooked?: () => void
}) {
  const [dirty, setDirty] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  // Stop the page behind from scrolling while the modal is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmDiscard) setConfirmDiscard(false)
      else requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, confirmDiscard])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Book a service"
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4"
    >
      <div className="relative h-[100dvh] w-full overflow-y-auto bg-background sm:h-[92vh] sm:max-w-[92rem] sm:rounded-2xl sm:shadow-2xl">
        <div className="sticky top-0 z-10 flex justify-end p-3">
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="cursor-pointer rounded-full border bg-card p-2 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="-mt-12">
          <BookingPage
            mode="modal"
            initialVehicleId={initialVehicleId}
            onClose={onClose}
            onBooked={onBooked}
            onDirtyChange={setDirty}
          />
        </div>
      </div>

      {confirmDiscard && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">Discard this booking?</h3>
            <p className="mt-1 text-sm text-muted-foreground">What you picked will be lost.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
