import type { NotificationItem } from '@/components/NotificationBell'

function timeAgoCustomer(iso: string): string {
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function timeAgoAdmin(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSecs = Math.floor((Date.now() - then) / 1000)
  if (diffSecs < 0) {
    return new Date(then).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (diffSecs < 60) return 'just now'
  const mins = Math.floor(diffSecs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export async function loadCustomerNotifications(limit?: number): Promise<NotificationItem[]> {
  const stored = typeof window !== "undefined" ? sessionStorage.getItem("autokita_user_id") : null
  const userId = stored ? parseInt(stored, 10) : 280
  
  const url = limit ? `/api/customer/notifications?userId=${userId}&limit=${limit}` : `/api/customer/notifications?userId=${userId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Fetch failed')
  const json = await res.json()
  
  return (json.notifications ?? []).map(
    (a: any) => ({
      key: a.days_remaining !== undefined ? `${a.type}-${a.id}-${a.days_remaining}` : `${a.type}-${a.id}`,
      title: a.title,
      message: a.description,
      time: timeAgoCustomer(a.time),
      at: a.time,
      href: a.href || (a.job_order_id ? `/dashboard/tracking/${a.job_order_id}` : '/dashboard'),
    }),
  )
}

export async function loadAdminNotifications(limit?: number): Promise<NotificationItem[]> {
  const url = limit ? `/api/admin/notifications?limit=${limit}` : `/api/admin/notifications`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.success) throw new Error('Fetch failed')
  
  return (json.notifications as any[]).map((r) => ({
    key: r.notif_key,
    title: r.title,
    message: r.message,
    time: timeAgoAdmin(r.notif_time),
    at: r.notif_time,
    href: r.href ?? undefined,
  }))
}
