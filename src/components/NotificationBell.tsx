'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

export type NotificationItem = {
  key: string
  title: string
  message: string
  time: string
  href?: string
}

export function NotificationBell({
  notifications,
  storageKey,
  buttonClassName = 'relative rounded-md p-2 hover:bg-accent',
}: {
  notifications: NotificationItem[]
  storageKey: string
  buttonClassName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const lsKey = `${storageKey}:read`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) setReadKeys(new Set(JSON.parse(raw)))
    } catch {
      /* storage unavailable */
    }
  }, [lsKey])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function persist(next: Set<string>) {
    setReadKeys(next)
    try {
      localStorage.setItem(lsKey, JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }
  function markRead(key: string) {
    if (readKeys.has(key)) return
    persist(new Set(readKeys).add(key))
  }
  function markAllRead() {
    persist(new Set(notifications.map((n) => n.key)))
  }

  const unreadCount = notifications.filter((n) => !readKeys.has(n.key)).length

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Notifications" className={buttonClassName}>
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </button>

      {open && (
        <div className="animate-fade-up absolute right-0 z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-lg border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : (
              notifications.map((n) => {
                const unread = !readKeys.has(n.key)
                return (
                  <button
                    key={n.key}
                    onClick={() => {
                      markRead(n.key)
                      if (n.href) {
                        setOpen(false)
                        router.push(n.href)
                      }
                    }}
                    className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent ${
                      unread ? 'bg-accent/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
                      <span className="text-sm font-medium">{n.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{n.message}</span>
                    <span className="text-[11px] text-muted-foreground">{n.time}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}