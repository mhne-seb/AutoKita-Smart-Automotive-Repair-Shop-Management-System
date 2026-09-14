'use client'

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, History, User, LogOut, Settings, X, ChevronDown } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useScrolled } from "@/hooks/use-scrolled";
import { NotificationBell, type NotificationItem } from '@/components/NotificationBell'

const BRAND_GRADIENT = "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)";

// "Book Service" was a misleading label for /dashboard — that route is the
// account overview (active services, vehicles, alerts), not a booking form.
// Booking now happens from the "Book New Service" action on that page itself.
const TABS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard/history", label: "Service History", icon: History },
] as const;

const FALLBACK_USER_ID = 280

function timeAgo(iso: string): string {
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

export function DashHeader() {
  const pathname = usePathname();
  const scrolled = useScrolled(20);
  const [open, setOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [me, setMe] = useState<{ name: string; email: string } >({ name: "Customer", email: ""});
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
   const stored = typeof window !== "undefined" ? sessionStorage.getItem("autokita_user_id") : null;
    const userId = stored ? parseInt(stored, 10) : FALLBACK_USER_ID;
    fetch(`/api/customer/notifications?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        const items: NotificationItem[] = (json.notifications ?? []).map(
          (a: { type: string; id: number; title: string; description: string; time: string }) => ({
            key: `${a.type}-${a.id}`,
            title: a.title,
            message: a.description,
            time: timeAgo(a.time),
          }),
        );
        setNotifications(items);
      })
      .catch(() => {
        /* leave the bell empty if the fetch fails */
      });
  }, []);

    useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("autokita_user_id") : null;
    const userId = stored ? parseInt(stored, 10) : FALLBACK_USER_ID;
    fetch(`/api/customer/profile?userId=${userId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          const name =
            [j.user.first_name, j.user.last_name].filter(Boolean).join(" ") || j.user.nickname || "Customer";
          setMe({ name, email: j.user.email ?? "" });
        }
      })
      .catch(() => {
        /* keep the placeholder if it fails */
      });
  }, []);

  function confirmLogout() {
    setLogoutConfirmOpen(false);
    // Clear the mock session so the (customer) layout's auth guard kicks in again.
    if (typeof window !== "undefined") sessionStorage.removeItem("autokita_customer");
    router.push("/login");
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? "shadow-sm shadow-black/5" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard" className="transition-transform duration-200 hover:scale-[1.03]">
            <Logo />
          </Link>

          <nav className="flex items-center gap-1.5 rounded-full border bg-muted/40 p-1">
            {TABS.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to}
                  href={t.to}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "text-white shadow-sm"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                  style={active ? { backgroundImage: BRAND_GRADIENT } : undefined}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <NotificationBell notifications={notifications} storageKey="autokita-customer-notifs" />
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-muted/60"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ backgroundImage: BRAND_GRADIENT }}
                >
                  <User className="h-4 w-4" />
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="animate-fade-up absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border bg-card shadow-xl">
                  <div className="flex items-center gap-3 border-b p-4" style={{ backgroundImage: BRAND_GRADIENT }}>
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-2 ring-white/25">
                      <User className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{me.name}</div>
                      <div className="truncate text-xs text-white/75">{me.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); router.push("/dashboard/profile"); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" /> Customize Profile
                  </button>
                  <button
                    onClick={() => { setOpen(false); setLogoutConfirmOpen(true); }}
                    className="flex w-full items-center gap-2.5 border-t px-4 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="h-16" />

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="animate-fade-up w-full max-w-sm overflow-hidden rounded-xl border bg-card shadow-xl">
            <div className="h-1 w-full" style={{ backgroundImage: BRAND_GRADIENT }} />
            <div className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <LogOut className="h-5 w-5 text-destructive" />
                </div>
                <button
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="text-base font-semibold">Log out?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Are you sure you want to log out of your account?
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setLogoutConfirmOpen(false)}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}