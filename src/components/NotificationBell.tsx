'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'

export type NotificationItem = {
  key: string
  title: string
  message: string
  time: string
  at?: string
  href?: string
}

import { NotificationsModal } from './NotificationsModal'

export function NotificationBell({
  notifications,
  storageKey,
  loadAll,
  buttonClassName = 'relative cursor-pointer rounded-md p-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-accent active:translate-y-0',
}: {
  notifications: NotificationItem[]
  storageKey: string
  loadAll?: () => Promise<NotificationItem[]>
  buttonClassName?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const lsKey = `${storageKey}:read`

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem(lsKey)
        if (raw) setReadKeys(new Set(JSON.parse(raw)))
      } catch {}
    }
    handleStorageChange()
    window.addEventListener('autokita-notifs-read', handleStorageChange)
    return () => window.removeEventListener('autokita-notifs-read', handleStorageChange)
  }, [lsKey])

  const [modalOpen, setModalOpen] = useState(false)

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

  const seenKeys = useRef<Set<string> | null>(null)
  const loadedAt = useRef(Date.now())
  const isFresh = (at?: string) => {
    if (!at) return false
    const t = new Date(at).getTime()
    if (Number.isNaN(t)) return false
    return t >= loadedAt.current - 60_000 && t <= Date.now() + 5 * 60_000
  }
  useEffect(() => {
    if (notifications.length === 0 && seenKeys.current === null) return
    if (seenKeys.current === null) {
      seenKeys.current = new Set(notifications.map((n) => n.key))
      return
    }
    for (const n of notifications) {
      if (seenKeys.current.has(n.key)) continue
      seenKeys.current.add(n.key)
      if (readKeys.has(n.key)) continue
      if (!isFresh(n.at)) continue
      toast(n.title, {
        description: n.message,
        duration: 8000,
        action: n.href
          ? { label: 'Open', onClick: () => { markRead(n.key); router.push(n.href!) } }
          : undefined,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications])

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
              <button onClick={markAllRead} className="cursor-pointer text-xs text-primary transition-all duration-200 hover:-translate-y-0.5 hover:underline active:translate-y-0">
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
                    className={`relative z-10 cursor-pointer flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left last:border-b-0 transition-all duration-200 hover:z-20 hover:bg-accent hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 ${
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
          {loadAll && (
            <div className="border-t p-2">
              <button
                onClick={() => {
                  setOpen(false)
                  setModalOpen(true)
                }}
                className="cursor-pointer w-full rounded-md py-2 text-center text-sm font-medium text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm hover:underline active:translate-y-0"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {modalOpen && loadAll && (
        <NotificationsModal
          storageKey={storageKey}
          loadAll={loadAll}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}