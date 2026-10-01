'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'

interface DraggableChatTriggerProps {
  open: boolean
  onClick: () => void
  ariaLabel: string
  title?: string
  storageKey?: string
}

export function DraggableChatTrigger({
  open,
  onClick,
  ariaLabel,
  title = 'AutoKita AI Assistant (Drag to reposition)',
  storageKey = 'autokita_chatbot_btn_pos',
}: DraggableChatTriggerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const positionRef = useRef<{ x: number; y: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const dragRef = useRef<{
    startX: number
    startY: number
    initialX: number
    initialY: number
    hasDragged: boolean
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasDragged: false,
  })

  // Load saved position on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          const BUTTON_SIZE = 56
          const PADDING = 12
          const maxX = Math.max(PADDING, window.innerWidth - BUTTON_SIZE - PADDING)
          const maxY = Math.max(PADDING, window.innerHeight - BUTTON_SIZE - PADDING)
          const clamped = {
            x: Math.min(Math.max(PADDING, parsed.x), maxX),
            y: Math.min(Math.max(PADDING, parsed.y), maxY),
          }
          setPosition(clamped)
          positionRef.current = clamped
        }
      }
    } catch {}
  }, [storageKey])

  // Keep button inside viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null
        const BUTTON_SIZE = 56
        const PADDING = 12
        const maxX = Math.max(PADDING, window.innerWidth - BUTTON_SIZE - PADDING)
        const maxY = Math.max(PADDING, window.innerHeight - BUTTON_SIZE - PADDING)
        const clamped = {
          x: Math.min(Math.max(PADDING, prev.x), maxX),
          y: Math.min(Math.max(PADDING, prev.y), maxY),
        }
        positionRef.current = clamped
        return clamped
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return

    const btn = buttonRef.current
    if (!btn) return

    const rect = btn.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
      hasDragged: false,
    }

    setIsDragging(true)
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragRef.current.startX
    const deltaY = e.clientY - dragRef.current.startY

    // Require small movement threshold so quick clicks don't count as drag
    if (!dragRef.current.hasDragged && Math.hypot(deltaX, deltaY) > 4) {
      dragRef.current.hasDragged = true
    }

    if (dragRef.current.hasDragged) {
      const BUTTON_SIZE = 56
      const PADDING = 12
      const maxX = Math.max(PADDING, window.innerWidth - BUTTON_SIZE - PADDING)
      const maxY = Math.max(PADDING, window.innerHeight - BUTTON_SIZE - PADDING)

      const nextX = Math.min(Math.max(PADDING, dragRef.current.initialX + deltaX), maxX)
      const nextY = Math.min(Math.max(PADDING, dragRef.current.initialY + deltaY), maxY)

      const nextPos = { x: nextX, y: nextY }
      positionRef.current = nextPos
      setPosition(nextPos)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return
    setIsDragging(false)

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}

    if (dragRef.current.hasDragged && positionRef.current) {
      // Save position to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(positionRef.current))
      } catch {}
    } else {
      // If it wasn't a drag, trigger open click
      onClick()
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      title={title}
      style={
        position
          ? { left: `${position.x}px`, top: `${position.y}px` }
          : undefined
      }
      className={`fixed ${isDragging ? 'z-[70]' : 'z-[60]'} flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-1 ring-black/5 select-none touch-none transition-shadow ${
        !position ? 'bottom-6 right-6' : ''
      } ${
        isDragging
          ? 'cursor-grabbing scale-105 shadow-2xl opacity-90'
          : 'cursor-grab hover:scale-105 hover:shadow-xl hover:opacity-95'
      } ${open ? 'hidden' : ''}`}
    >
      <Bot className="h-6 w-6 pointer-events-none" strokeWidth={2.25} />
    </button>
  )
}
