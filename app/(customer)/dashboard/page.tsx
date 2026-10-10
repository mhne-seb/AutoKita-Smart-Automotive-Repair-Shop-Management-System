'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Wrench,
  Gauge,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Hash,
  ClipboardCheck,
  User,
  X,
  MapPin,
  Search,
  CreditCard,
  RefreshCw,
  Loader2,
  Sparkles,
  Car,
  Inbox,
  ShieldCheck,
  Download,
  Calendar,
  CalendarClock,
  Camera,
  XCircle,
  Gift,
  Copy,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { VehicleInServiceModal } from "@/components/dashboard/VehicleInServiceModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { loadCustomerNotifications } from "@/lib/notificationFeeds";
import { ShopLoading } from "@/components/ShopLoading";
import { requiresDiagnosticScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import type {
  DashboardData,
  DashboardActivity,
  DashboardJobOrder,
  DashboardPendingTicket,
  DashboardShop,
} from "@/controllers/dashboardController";
import { getCompletedData } from "@/controllers/serviceProgressController";
import { fetchJobOrderPdfData, generateJobOrderPdf } from "@/lib/jobOrderPdf";
import { formatStamp, cn } from "@/lib/utils";
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from "@/lib/plate";
import { TimeslotPicker } from "@/components/TimeslotPicker";
import { toManilaIso } from "@/lib/bookingSlotsShared";
import { Modal } from "@/components/dashboard/Modal";
import { STATUS_TO_STEP } from "@/data/trackingStages";
import { BookServiceModal } from "@/components/dashboard/BookServiceModal";
import { ServiceReportModal } from "@/components/dashboard/ServiceReportModal";

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

// Status (the status -> stage rule lives in src/data/trackingStages.ts)
const STATUS_LABEL: Record<string, string> = {
  inspecting:                 "Under Inspection",
  pending_customer_approval:  "Pending Approval",
  revision_pending:           "Revision Pending",
  waiting_on_parts:           "Waiting on Parts",
  in_progress:                "In Progress",
  testing:                    "Road Testing",
  completed:                  "Billing & Payment",
  released:                   "Released",
  cancelled:                  "Cancelled",
};

// A job is off the active list only once the car has gone home (or the job was cancelled).
const DONE_STATUSES = new Set(["released", "cancelled"]);
// Labels for a submitted booking that hasn't become a job order yet.
const TICKET_STATUS_LABEL: Record<string, string> = {
  pending:              "Awaiting Confirmation",
  queued:               "In Queue",
  inspection_scheduled: "Inspection Scheduled",
};

// The currently "logged in" demo customer — matches user_id 280 in the DB.
const CURRENT_USER_ID = 280;

function formatMoney(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Dashboard() {
  useEffect(() => { document.title = "Dashboard — AutoKita"; }, []);

  const [contactOpen, setContactOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [bookServiceOpen, setBookServiceOpen] = useState(false);
  const [initialVehicleId, setInitialVehicleId] = useState<string | undefined>();
  const [reportJobId, setReportJobId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('book') === '1') {
        setBookServiceOpen(true);
        const vehicleParam = urlParams.get('vehicle');
        if (vehicleParam && /^\d+$/.test(vehicleParam)) {
          setInitialVehicleId(vehicleParam);
        }
        urlParams.delete('book');
        urlParams.delete('vehicle');
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  // Dynamic data from PostgreSQL
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Two-step cancel on a pending booking: first click arms it, second confirms.
  const [cancelArmedId, setCancelArmedId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // silent = a background poll: update the data in place with no spinner.
  const fetchDashboard = async (isManualRefresh = false, silent = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      // Get the logged in user ID from sessionStorage
      const storedUserId = sessionStorage.getItem('autokita_user_id');
      const userId = storedUserId ? parseInt(storedUserId, 10) : CURRENT_USER_ID;

      const res = await fetch(`/api/dashboard?userId=${userId}`);
      if (res.status === 401) {
        setSessionExpired(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      const json: DashboardData = await res.json();
      setData(json);
      setLastSynced(
        new Date().toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );
    } catch (e: unknown) {
      // A failed background poll shouldn't replace the page with an error —
      // the data on screen is still good; the next poll will try again.
      if (!silent) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const cancelTicket = async (ticketId: number) => {
    setCancellingId(ticketId);
    try {
      const storedUserId = sessionStorage.getItem('autokita_user_id');
      const userId = storedUserId ? parseInt(storedUserId, 10) : CURRENT_USER_ID;
      const res = await fetch('/api/customer/tickets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ticketId }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        toast.success('Booking cancelled.');
        await fetchDashboard(true);
      } else {
        toast.error(json?.message ?? 'Could not cancel this booking.');
      }
    } finally {
      setCancellingId(null);
      setCancelArmedId(null);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  // Keep the page live: alerts, recent activity and service status re-fetch
  // every 10 s in the background, so what the shop does shows up here
  // without a reload (the bell in the header does the same).
  useEffect(() => {
    if (sessionExpired) return;
    const t = setInterval(() => fetchDashboard(false, true), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExpired]);

  // Activity icon/colour helpers
  const activityMeta = (type: DashboardActivity["type"]) => {
    switch (type) {
      case "payment":
        return { icon: CreditCard, color: "text-success" };
      case "progress_log":
        return { icon: Wrench, color: "text-brand" };
      case "status_change":
        return { icon: RefreshCw, color: "text-warning" };
      case "booking_accepted":
        return { icon: CheckCircle2, color: "text-success"};
      case "report_ready":
        return { icon: ClipboardCheck, color: "text-brand" };
      case "appointment_reminder":
        return { icon: CalendarClock, color: "text-amber-500" };
      case "job_update":
        return { icon: Wrench, color: "text-brand" };
      default:
        return { icon: FileText, color: "text-muted-foreground" };
    }
  };

  // Loading / error states
  if (loading) {
    return (
      <ShopLoading message="Loading your dashboard" />
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{error ?? "No data"}</p>
        <button
          onClick={() => fetchDashboard()}
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  const { user, vehicles, activeJobOrders, pendingTickets, recentActivity, shop } = data;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">

          {/* WELCOME */}
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[color:oklch(0.22_0.05_250)] to-brand p-6 text-white shadow-lg md:p-7">
            <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

            <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-xl font-bold ring-2 ring-white/25">
                  {user
                    ? (user.first_name?.[0] ?? user.nickname?.[0] ?? "?").toUpperCase()
                    : "?"}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/60">Welcome back</div>
                  <h1 className="mt-0.5 text-2xl font-bold leading-tight md:text-3xl">
                    {user ? (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.nickname) : "Customer"} 👋
                  </h1>
                  <p className="mt-1.5 max-w-sm text-sm text-white/75">
                    Your vehicles are being looked after. Here&apos;s what&apos;s happening today.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15 md:flex-col md:items-start md:gap-1">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-white/70" />
                  <div className="text-2xl font-bold tabular-nums">{activeJobOrders.length}</div>
                </div>
                <div className="text-xs text-white/70">Active {activeJobOrders.length === 1 ? "service" : "services"}</div>
              </div>
            </div>

            {user && (
              <div className="relative mt-5 flex flex-wrap gap-2 border-t border-white/15 pt-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/85">
                  <Mail className="h-3 w-3" /> {user.email}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/85">
                  <Phone className="h-3 w-3" /> {user.contact_number}
                </span>
              </div>
            )}
          </section>

          {/* RETENTION OFFERS & PROMOS */}
          {data.retentionOffers && data.retentionOffers.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Gift className="h-3.5 w-3.5" />
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">Special Offers For You</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exclusive discounts & rewards issued specifically for your vehicle maintenance.
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                  {data.retentionOffers.length} {data.retentionOffers.length === 1 ? 'Offer' : 'Offers'} Available
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.retentionOffers.map((offer) => {
                  const isPercent = offer.offer_type === 'percentage_discount';
                  const isFixed = offer.offer_type === 'fixed_discount';
                  const isFree = offer.offer_type === 'free_service';
                  const isLoyalty = offer.offer_type === 'loyalty_reward';

                  const badgeText = isPercent
                    ? `${offer.discount_value}% OFF`
                    : isFixed
                    ? `₱${formatMoney(offer.discount_value)} OFF`
                    : isFree
                    ? 'COMPLIMENTARY'
                    : isLoyalty
                    ? 'LOYALTY REWARD'
                    : 'MAINTENANCE';

                  const badgeColor = isPercent
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : isFixed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isFree
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200';

                  return (
                    <div
                      key={offer.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${badgeColor}`}>
                          {badgeText}
                        </span>
                        {offer.expiration_date && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> Valid until {offer.expiration_date}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium text-slate-800 leading-snug">
                        {offer.description}
                      </p>

                      {offer.promo_code && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200/80 px-3 py-2">
                          <div>
                            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                              Promo Code
                            </span>
                            <span className="font-mono text-sm font-bold text-slate-900 tracking-wider">
                              {offer.promo_code}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(offer.promo_code || '');
                              setCopiedCode(offer.promo_code);
                              toast.success(`Promo code "${offer.promo_code}" copied to clipboard!`);
                              setTimeout(() => setCopiedCode(null), 2500);
                            }}
                            className="flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                          >
                            {copiedCode === offer.promo_code ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 text-slate-500" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {pendingTickets.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">Pending Requests</h2>
              <p className="text-xs text-muted-foreground">
                Submitted bookings waiting for the shop to confirm.
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {pendingTickets.map((t) => (
                  <div key={t.id} className="rounded-xl border border-dashed bg-card p-5">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
                        {TICKET_STATUS_LABEL[t.ticket_status] ?? t.ticket_status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">#TKT-{t.id}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold">
                      {t.vehicle_year} {t.vehicle_model}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{t.plate_number}</div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Clock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                        <span>
                          Requested {formatRelativeTime(t.request_date)} ·{" "}
                          {t.service_mode === "home_service" ? "Home Service" : "Walk-in"}
                        </span>
                      </div>
                      {t.preferred_datetime && (
                        <div className="flex items-start gap-1.5 text-xs font-medium text-brand">
                          <Calendar className="mt-0.5 h-3 w-3 flex-shrink-0" />
                          <span>
                            Schedule: {new Date(t.preferred_datetime).toLocaleString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Free to cancel while the shop hasn't started — the API
                        enforces the same rule, this is just the affordance. */}
                    <div className="mt-4 border-t pt-3">
                      {cancelArmedId === t.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Cancel this booking?</span>
                          <button
                            onClick={() => cancelTicket(t.id)}
                            disabled={cancellingId === t.id}
                            className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            {cancellingId === t.id ? "Cancelling…" : "Yes, cancel"}
                          </button>
                          <button
                            onClick={() => setCancelArmedId(null)}
                            disabled={cancellingId === t.id}
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
                          >
                            Keep it
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCancelArmedId(t.id)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel booking
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          
          <section>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white shadow-md">
                  <Wrench className="h-4.5 w-4.5" />
                </div>
                <h2
                  className="bg-clip-text text-lg font-bold tracking-tight text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)" }}
                >
                  My Services
                </h2>
              </div>
              <button
                onClick={() => fetchDashboard(true)}
                className="group flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-brand"
              >
                <RefreshCw className={`h-3 w-3 transition-transform duration-500 ${isRefreshing ? "animate-spin" : "group-hover:rotate-90"}`} />
                Last synced: Today, {lastSynced || "—"}
              </button>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {activeJobOrders.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active services yet — book one from the button above.
                </div>
              ) : (
                activeJobOrders.map((job) => {
                  const matchedVehicle = vehicles.find(
                    (v) => v.vehicle_year === job.vehicle_year && v.vehicle_model === job.vehicle_model,
                  );
                  const isAwaitingDropoff = job.status === "inspecting" && !job.date_arrived;
                  return (
                    <ServiceCard
                      key={job.id}
                      vehicle={`${job.vehicle_year} ${job.vehicle_model}`}
                      plate={matchedVehicle?.plate_number}
                      jobOrderId={`#JO-${job.id}`}
                      jobId={job.id}
                      status={isAwaitingDropoff ? "Awaiting Drop-off" : (STATUS_LABEL[job.status] ?? job.status)}
                      note={job.service_name ?? "Service"}
                      stepIndex={isAwaitingDropoff ? 0 : (STATUS_TO_STEP[job.status] ?? 0)}
                      isDone={DONE_STATUSES.has(job.status)}
                      balanceDue={job.status === "cancelled" ? 0 : Number(job.balance ?? 0)}
                      cancelled={job.status === "cancelled"}
                      onViewReport={() => setReportJobId(job.id)}
                    />
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Quick Actions
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setBookServiceOpen(true)}
                className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:opacity-90 active:translate-y-0"
              >
                <Plus className="h-4 w-4" /> Book New Service
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm hover:bg-accent active:translate-y-0"
              >
                <MessageCircle className="h-4 w-4" /> Contact Shop Office
              </button>
            </div>
          </div>


          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Your Vehicles</span>
              <Link href="/dashboard/vehicles" className="text-brand hover:underline normal-case">View all</Link>
            </div>
            <div className="mt-4 space-y-3">
              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vehicles yet. <Link href="/dashboard/vehicles/new" className="text-brand hover:underline">Register your first vehicle.</Link>
                </p>
              ) : (
                vehicles.map((v) => {
                  // The server says which cars are in the shop (by vehicle id), the same answer My Vehicles uses.
                  const inService = v.in_service;
                  return (
                    <VehicleRow
                      key={v.id}
                      model={`${v.vehicle_year} ${v.vehicle_model}`}
                      plate={v.plate_number}
                      type={v.vehicle_type}
                      inService={inService}
                      onBook={() => {
                        setInitialVehicleId(String(v.id));
                        setBookServiceOpen(true);
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Recent Activity
              </div>
              <button
                onClick={() => setNotificationsModalOpen(true)}
                className="text-[11px] font-medium text-brand hover:underline"
              >
                View All
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <Inbox className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
                </div>
              ) : (
                recentActivity.slice(0, 5).map((act) => {
                  const meta = activityMeta(act.type);
                  return (
                    <Activity
                      key={`${act.type}-${act.id}`}
                      icon={meta.icon}
                      color={meta.color}
                      title={act.title}
                      time={formatRelativeTime(act.time)}
                      desc={act.description}
                    />
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {contactOpen && <ContactShopModal shop={shop} onClose={() => setContactOpen(false)} />}
      {notificationsModalOpen && (
        <NotificationsModal
          storageKey="autokita-customer-notifs"
          loadAll={() => loadCustomerNotifications(100)}
          onClose={() => setNotificationsModalOpen(false)}
        />
      )}
      {bookServiceOpen && (
        <BookServiceModal
          initialVehicleId={initialVehicleId}
          onClose={() => { setBookServiceOpen(false); setInitialVehicleId(undefined); }}
          onBooked={() => fetchDashboard(true)}
        />
      )}
      {reportJobId !== null && (
        <ServiceReportModal jobId={reportJobId} onClose={() => setReportJobId(null)} />
      )}
      {confirmModal && (
        <ConfirmModal data={confirmModal} onClose={() => setConfirmModal(null)} />
      )}

      {sessionExpired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Session Expired</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              For your security, your session has timed out. Please log in again to continue.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('autokita_customer');
                sessionStorage.removeItem('autokita_user_id');
                window.location.href = '/login';
              }}
              className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              Log In Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility: relative time formatting

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function formatBadgeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  // Clamped at 0: a row written a second ago can read as "in the future" if
  // the server's clock is slightly ahead of the browser's.
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "JUST NOW";
  if (diffMins < 60) return `${diffMins}M AGO`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}H AGO`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}D AGO`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }).toUpperCase();
}


// Contact Shop modal

function ContactShopModal({ shop, onClose }: { shop: DashboardShop | null; onClose: () => void }) {
  // Format operating hours for display
  const formatHours = (hours: Record<string, string> | null | undefined) => {
    if (!hours) return "Contact shop for hours";
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const weekday = days.slice(0, 5).map((d) => hours[d]).filter(Boolean);
    const sat = hours["saturday"];
    const sun = hours["sunday"];
    const weekdayStr = weekday.length > 0 ? `Mon–Fri: ${weekday[0]}` : "";
    const satStr = sat ? `Sat: ${sat}` : "";
    const sunStr = sun ? `Sun: ${sun}` : "";
    return [weekdayStr, satStr, sunStr].filter(Boolean).join(" | ");
  };

  return (
    <Modal onClose={onClose}>
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{shop?.name ?? "AutoKita Service Center"}</h3>
              <p className="text-xs text-muted-foreground">We&apos;re here to help</p>
            </div>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Phone</div>
                <div className="text-muted-foreground">{shop?.contact_number ?? "N/A"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Email</div>
                <div className="text-muted-foreground">{shop?.email ?? "N/A"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Address</div>
                <div className="text-muted-foreground">{shop?.address ?? "N/A"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Business Hours</div>
                <div className="text-muted-foreground">{formatHours(shop?.operating_hours)}</div>
              </div>
            </div>
          </div>

          <a
            href={`tel:${shop?.contact_number ?? ""}`}
            className="mt-6 lg:hidden flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" /> Call Shop Now
          </a>
        </>
      )}
    </Modal>
  );
}



// Generic confirm modal

type ConfirmModalData = {
  tone: "brand" | "destructive";
  title: string;
  body: string;
  details?: { label: string; value: string }[];
  confirmLabel: string;
  onConfirm: () => void;
};

function ConfirmModal({ data, onClose }: { data: ConfirmModalData; onClose: () => void }) {
  const confirmClasses =
    data.tone === "destructive"
      ? "bg-destructive text-white hover:opacity-90"
      : "bg-[color:oklch(0.22_0.05_250)] text-white hover:opacity-90";

  return (
    <Modal onClose={onClose}>
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">{data.title}</h3>
            <button onClick={close} className="rounded-md p-1 transition-all duration-200 hover:bg-accent cursor-pointer hover:-translate-y-0.5 active:translate-y-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{data.body}</p>

          {data.details && (
            <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3">
              {data.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => {
                data.onConfirm();
                close();
              }}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md ${confirmClasses}`}
            >
              {data.confirmLabel}
            </button>
            <button
              onClick={close}
              className="flex-1 rounded-md border py-2.5 text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:bg-accent hover:shadow-sm"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Service card with stepper (hidden once the service is done)

const SERVICE_STEPS = [
  { label: "Received", icon: Car },
  { label: "Inspecting", icon: Search },
  { label: "Quotation", icon: FileText },
  { label: "In Progress", icon: Wrench },
  { label: "Testing", icon: Gauge },
  { label: "Billing", icon: CreditCard },
  { label: "Completed", icon: CheckCircle2 },
];

function ServiceCard({
  vehicle,
  plate,
  jobOrderId,
  jobId,
  status,
  note,
  stepIndex,
  isDone,
  balanceDue = 0,
  cancelled = false,
  onViewReport,
}: {
  vehicle: string;
  plate?: string;
  jobOrderId: string;
  jobId: number;
  status: string;
  note: string;
  stepIndex: number;
  isDone: boolean;
  balanceDue?: number;
  cancelled?: boolean;
  onViewReport: () => void;
}) {
  const statusTones = [
    "bg-muted text-muted-foreground",                 // received
    "bg-brand-soft text-brand",                       // inspecting
    "bg-purple-500/10 text-purple-600",                // pending approval / revision
    "bg-brand-soft text-brand",                       // waiting on parts / in progress
    "bg-sky-500/10 text-sky-600",                      // testing
    "bg-teal/10 text-teal",                            // billing
    "bg-success/10 text-success",                     // released
  ];
  const statusTone = statusTones[Math.min(Math.max(stepIndex, 0), statusTones.length - 1)];

  return (
    <div
      className="group overflow-hidden rounded-xl border bg-card transition-shadow duration-300 hover:shadow-lg"
    >
      {/* thin gradient accent, ties this card back to the brand without washing the whole card in blue */}
      <div className="h-1 w-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />

      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold leading-tight">{vehicle}</h3>
            {plate && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {plate}
              </span>
            )}
          </div>
          <span className="flex-shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">
            {jobOrderId}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            <Wrench className="h-3.5 w-3.5 text-muted-foreground" /> {note}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}>
            {status}
          </span>
        </div>

        {isDone ? (
          cancelled ? (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs font-medium text-muted-foreground">
              <XCircle className="h-4 w-4 shrink-0" /> This service was cancelled.
            </div>
          ) : balanceDue > 0 ? (
            <div className="mt-5 rounded-lg bg-warning/15 px-3 py-2.5 text-xs">
              <div className="flex items-center gap-2 font-semibold text-[color:oklch(0.55_0.15_60)]">
                <AlertCircle className="h-4 w-4 shrink-0" /> Service completed — ₱{balanceDue.toLocaleString("en-PH", { minimumFractionDigits: 2 })} balance due
              </div>
              <p className="mt-1 text-muted-foreground">Settle the balance to pick up your vehicle.</p>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> This service has been completed and paid in full.
            </div>
          )
        ) : (
          <div className="mt-6 flex items-start">
            {SERVICE_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isStepDone = i < stepIndex;
              const isCurrent = i === stepIndex;
              const isActive = isStepDone || isCurrent;
              return (
                <div key={step.label} className="relative flex flex-1 flex-col items-center last:flex-none">
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className="relative flex h-7 w-7 items-center justify-center bg-card">
                      {isCurrent && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                      )}
                      <div
                        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform duration-300 ${
                          isActive
                            ? "border-brand bg-brand text-white"
                            : "border-muted bg-muted/50 text-muted-foreground"
                        } ${isCurrent ? "scale-110" : ""}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap text-center text-[6.5px] font-semibold uppercase leading-tight tracking-tighter transition-colors duration-300 ${
                        isActive ? "text-brand" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < SERVICE_STEPS.length - 1 && (
                    <div className={`absolute top-3.5 left-1/2 h-0.5 w-full transition-colors duration-300 ${isStepDone ? "bg-brand" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-4 border-t pt-4">
          {isDone ? (
            <>
              <button
                onClick={onViewReport}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-[color:oklch(0.22_0.05_250)]"
              >
                View Service Report
                <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              {balanceDue > 0 && (
                <Link
                  href={`/dashboard/tracking/billing?jobOrderId=${jobId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Pay Balance
                </Link>
              )}
            </>
          ) : (
            <Link
              href={`/dashboard/tracking/${["received", "inspecting", "quotation", "in-progress", "testing", "billing", "completed"][stepIndex] ?? "received"}?jobOrderId=${jobId}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition-colors hover:text-[color:oklch(0.22_0.05_250)]"
            >
              View Tracking
              <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Activity({
  icon: Icon,
  color,
  title,
  time,
  desc,
}: {
  icon: any;
  color: string;
  title: string;
  time: string;
  desc: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold">{title}</div>
          <div className="shrink-0 text-[10px] text-muted-foreground">{time}</div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function VehicleRow({
  model,
  plate,
  type,
  inService = false,
  onBook,
}: {
  model: string;
  plate: string;
  type: string;
  inService?: boolean;
  onBook?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-md border bg-muted/30 p-2.5 transition-colors hover:bg-muted/60">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
        <Wrench className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-semibold">{model}</div>
          {inService && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-medium text-success">
              <span className="h-1 w-1 rounded-full bg-success" /> In Service
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{plate} · {type}</div>
      </div>
      {!inService && onBook && (
        <button
          type="button"
          onClick={onBook}
          className="flex-shrink-0 rounded-md bg-brand px-2.5 py-1.5 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Book a service
        </button>
      )}
    </div>
  );
}


export default Dashboard;