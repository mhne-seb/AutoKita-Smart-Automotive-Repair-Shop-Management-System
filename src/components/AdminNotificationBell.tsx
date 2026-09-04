'use client'

import { useEffect, useState } from 'react'
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell'

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Row = {
  notif_key: string
  title: string
  message: string
  notif_time: string
  href: string | null
}

export function AdminNotificationBell({ buttonClassName }: { buttonClassName?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/admin/notifications')
        const json = await res.json()
        if (!alive || !json.success) return
        setItems(
          (json.notifications as Row[]).map((r) => ({
            key: r.notif_key,
            title: r.title,
            message: r.message,
            time: timeAgo(r.notif_time),
            href: r.href ?? undefined,
          })),
        )
      } catch {
        /* ignore network errors */
      }
    }
    load()
    const t = setInterval(load, 45000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  return (
    <NotificationBell
      notifications={items}
      storageKey="autokita-admin-notifs"
      buttonClassName={
        buttonClassName ??
        'relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }
    />
  )
}