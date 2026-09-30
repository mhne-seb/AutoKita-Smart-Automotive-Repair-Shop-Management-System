'use client'

import { useEffect, useState } from 'react'
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell'

import { loadAdminNotifications } from '@/lib/notificationFeeds'

export function AdminNotificationBell({ buttonClassName }: { buttonClassName?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const data = await loadAdminNotifications()
        if (alive) setItems(data)
      } catch {
        /* ignore network errors */
      }
    }
    load()
    // Every 30 s, and only while this tab is on screen — an admin page left
    // open in a background tab all day was most of the project's Supabase
    // data usage. Coming back to the tab refreshes right away.
    const t = setInterval(() => { if (!document.hidden) load() }, 30000)
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return (
    <NotificationBell
      notifications={items}
      storageKey="autokita-admin-notifs"
      loadAll={() => loadAdminNotifications(100)}
      buttonClassName={
        buttonClassName ??
        'relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }
    />
  )
}