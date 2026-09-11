'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

// Full-screen photo viewer, shared by the admin inspection page and the
// customer tracking page. Closes on Esc, on the backdrop, or the X button.

export function Lightbox({
  url,
  label,
  onClose,
}: {
  url: string
  label?: string
  onClose: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while the viewer is open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6"
    >
      <button
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X size={20} />
      </button>

      {/* Clicking the photo itself shouldn't close the viewer. */}
      <figure onClick={(e) => e.stopPropagation()} className="max-w-5xl">
        <img
          src={url}
          alt={label ?? 'Inspection photo'}
          className="max-h-[80vh] w-auto rounded-lg object-contain"
        />
        {label && <figcaption className="mt-3 text-center text-sm text-white/80">{label}</figcaption>}
      </figure>
    </div>
  )
}