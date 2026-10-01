'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { NotificationItem } from '@/components/NotificationBell'

interface NotificationsModalProps {
  storageKey: string
  loadAll: () => Promise<NotificationItem[]>
  onClose: () => void
}

function getDayGroup(iso: string | undefined): 'Upcoming' | 'Today' | 'Yesterday' | 'Earlier' {
  if (!iso) return 'Earlier'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return 'Earlier'
  
  const today = new Date()
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
  if (date > endOfToday) return 'Upcoming'
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return 'Earlier'
}

export function NotificationsModal({ storageKey, loadAll, onClose }: NotificationsModalProps) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set())
  
  const loadRef = useRef(false)
  const lsKey = `${storageKey}:read`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey)
      if (raw) setReadKeys(new Set(JSON.parse(raw)))
    } catch {}
  }, [lsKey])

  const fetchItems = async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await loadAll()
      setItems(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loadRef.current) return
    loadRef.current = true
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function persist(next: Set<string>) {
    setReadKeys(next)
    try {
      localStorage.setItem(lsKey, JSON.stringify([...next]))
    } catch {}
    window.dispatchEvent(new Event('autokita-notifs-read'))
  }

  function markRead(key: string) {
    if (readKeys.has(key)) return
    persist(new Set(readKeys).add(key))
  }

  function markAllRead() {
    persist(new Set(items.map((n) => n.key)))
  }

  const unreadCount = items.filter((n) => !readKeys.has(n.key)).length
  const filteredItems = items.filter((n) => tab === 'all' || !readKeys.has(n.key))

  const grouped: Record<string, NotificationItem[]> = {
    Upcoming: [],
    Today: [],
    Yesterday: [],
    Earlier: [],
  }
  for (const item of filteredItems) {
    grouped[getDayGroup(item.at)].push(item)
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl h-[85vh] sm:h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sm font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex border-b px-4 sm:px-6">
          <button
            onClick={() => setTab('all')}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('unread')}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === 'unread'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-muted/20">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="mt-4 text-sm">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <p className="mb-4 text-sm text-destructive">Failed to load notifications.</p>
              <button
                onClick={fetchItems}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Try again
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="p-4 sm:p-6 space-y-6">
              {(['Upcoming', 'Today', 'Yesterday', 'Earlier'] as const).map(
                (group) =>
                  grouped[group].length > 0 && (
                    <div key={group}>
                      <h3 className="mb-3 font-semibold text-foreground/80">{group}</h3>
                      <div className="overflow-hidden rounded-lg border bg-card">
                        {grouped[group].map((n, i) => {
                          const unread = !readKeys.has(n.key)
                          const exactTime = n.at ? new Date(n.at).toLocaleString('en-PH') : ''
                          return (
                            <button
                              key={n.key}
                              onClick={() => {
                                markRead(n.key)
                                if (n.href) {
                                  onClose()
                                  router.push(n.href)
                                }
                              }}
                              className={`flex w-full items-start gap-4 border-b p-4 text-left last:border-0 hover:bg-accent ${
                                unread ? 'bg-accent/30' : ''
                              }`}
                            >
                              <div className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center">
                                {unread && <span className="h-2 w-2 rounded-full bg-destructive" />}
                              </div>
                              <div className="flex flex-1 flex-col gap-1">
                                <span className="font-medium">{n.title}</span>
                                <span className="text-sm text-muted-foreground">{n.message}</span>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                                  <span>{n.time}</span>
                                  {exactTime && (
                                    <>
                                      <span>•</span>
                                      <span>{exactTime}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
