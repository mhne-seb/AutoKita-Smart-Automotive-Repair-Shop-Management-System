'use client'

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Calendar, History, ShieldCheck, Bell, User, LogOut, Settings, X } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { useScrolled } from "@/hooks/use-scrolled";

const TABS = [
  { to: "/dashboard", label: "Book Service", icon: Calendar },
  { to: "/dashboard/billing", label: "Billing & Warranty", icon: ShieldCheck },
  { to: "/dashboard/history", label: "History", icon: History },
] as const;

const NOTIFICATIONS = [
  {
    id: 1,
    title: "Service reminder",
    message: "Your next PMS is due in 3 days.",
    time: "2h ago",
    unread: true,
  },
  {
    id: 2,
    title: "Warranty update",
    message: "Your extended warranty has been approved.",
    time: "1d ago",
    unread: true,
  },
  {
    id: 3,
    title: "Booking confirmed",
    message: "Your service appointment on July 8 is confirmed.",
    time: "3d ago",
    unread: false,
  },
];

export function DashHeader() {
  const pathname = usePathname();
  const scrolled = useScrolled(20);
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false);
    // Clear the mock session so the (customer) layout's auth guard kicks in again.
    if (typeof window !== "undefined") sessionStorage.removeItem("autokita_customer");
    router.push("/login");
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 glass-nav ${
          scrolled ? "glass-nav-scrolled" : ""
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard"><Logo /></Link>
          <nav className="flex gap-2">
            {TABS.map((t) => {
              const active = pathname === t.to;
              return (
                <Link
                  key={t.to}
                  href={t.to}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "border-brand font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative rounded-md p-2 hover:bg-accent"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
              {notifOpen && (
                <div className="animate-fade-up absolute right-0 mt-2 w-80 origin-top-right overflow-hidden rounded-lg border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-brand hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() =>
                            setNotifications((prev) =>
                              prev.map((item) =>
                                item.id === n.id ? { ...item, unread: false } : item
                              )
                            )
                          }
                          className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent ${
                            n.unread ? "bg-accent/40" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {n.unread && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                            )}
                            <span className="text-sm font-medium">{n.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{n.message}</span>
                          <span className="text-[11px] text-muted-foreground">{n.time}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div ref={ref} className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white hover:opacity-90"
              >
                <User className="h-4 w-4" />
              </button>
              {open && (
                <div className="animate-fade-up absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-lg border bg-card shadow-xl">
                  <div className="border-b px-4 py-3">
                    <div className="text-sm font-semibold">Juan Dela Cruz</div>
                    <div className="text-xs text-muted-foreground">juand.cruz@example.com</div>
                  </div>
                  <button
                    onClick={() => { setOpen(false); router.push("/dashboard/profile"); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                  >
                    <Settings className="h-4 w-4" /> Customize Profile
                  </button>
                  <button
                    onClick={() => { setOpen(false); setLogoutConfirmOpen(true); }}
                    className="flex w-full items-center gap-2 border-t px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
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
          <div className="animate-fade-up w-full max-w-sm rounded-lg border bg-card p-6 shadow-xl">
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
      )}
    </>
  );
}
