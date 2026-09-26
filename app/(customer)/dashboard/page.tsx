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
  Bell,
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
import { isValidPhPlate, PLATE_FORMAT_ERROR } from "@/lib/plateNumber";
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
import { formatStamp } from "@/lib/utils";

// Status
const STATUS_TO_STEP: Record<string, number> = {
  inspecting:                 1,
  pending_customer_approval:  2,
  revision_pending:           2,
  waiting_on_parts:           3,
  in_progress:                3,
  testing:                    4,
  completed:                  5,
  released:                   6,
  cancelled:                  6,
};

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bookServiceOpen, setBookServiceOpen] = useState(false);
  const [reportJobId, setReportJobId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

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
    const t = setInterval(() => fetchDashboard(false, true), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Clock className="mt-0.5 h-3 w-3 flex-shrink-0" />
                      <span>
                        Requested {formatRelativeTime(t.request_date)} ·{" "}
                        {t.service_mode === "home_service" ? "Home Service" : "Walk-in"}
                      </span>
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
                  return (
                    <ServiceCard
                      key={job.id}
                      vehicle={`${job.vehicle_year} ${job.vehicle_model}`}
                      plate={matchedVehicle?.plate_number}
                      jobOrderId={`#JO-${job.id}`}
                      jobId={job.id}
                      status={STATUS_LABEL[job.status] ?? job.status}
                      note={job.service_name ?? "Service"}
                      stepIndex={STATUS_TO_STEP[job.status] ?? 0}
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
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Book New Service
              </button>
              <button
                onClick={() => setContactOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-transform duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" /> Contact Shop Office
              </button>
            </div>
          </div>


          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Car className="h-3.5 w-3.5" /> Your Vehicles
            </div>
            <div className="mt-4 space-y-3">
              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles registered yet.</p>
              ) : (
                vehicles.map((v) => {
                  const inService = activeJobOrders.some(
                    (job) => job.vehicle_year === v.vehicle_year && job.vehicle_model === v.vehicle_model,
                  );
                  return (
                    <VehicleRow
                      key={v.id}
                      model={`${v.vehicle_year} ${v.vehicle_model}`}
                      plate={v.plate_number}
                      type={v.vehicle_type}
                      inService={inService}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* CONTEXTUAL ALERTS — from recent activity */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bell className="h-3.5 w-3.5" /> Contextual Alerts
            </div>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <ShieldCheck className="h-6 w-6 text-success/50" />
                  <p className="text-sm text-muted-foreground">No alerts at this time.</p>
                </div>
              ) : (
                recentActivity.slice(0, 3).map((act) => {
                  // A job moving to its next stage is news, not a problem — keep
                  // red for things that actually went wrong.
                  const tone: "destructive" | "neutral" | "success" =
                    act.type === "payment" || act.type === "booking_accepted"
                      ? "success"
                      : "neutral";
                  return (
                    <Alert
                      key={`alert-${act.type}-${act.id}`}
                      tone={tone}
                      title={act.title}
                      badge={formatBadgeTime(act.time)}
                      body={act.description}
                    />
                  );
                })
              )}
              <button
                onClick={() =>
                  setConfirmModal({
                    tone: "destructive",
                    title: "Clear All Notifications",
                    body: "This will clear all current notifications from your dashboard. You can still find them later in your full activity history.",
                    confirmLabel: "Clear All",
                    onConfirm: () => setConfirmModal(null),
                  })
                }
                className="w-full pt-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear All Notifications
              </button>
            </div>
          </div>

          {/* RECENT ACTIVITY */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Recent Activity
              </div>
              <button
                onClick={() => setHistoryOpen(true)}
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
                recentActivity.slice(0, 4).map((act) => {
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
      {historyOpen && <HistoryModal activities={recentActivity} onClose={() => setHistoryOpen(false)} />}
      {bookServiceOpen && (
        <BookServiceModal
          onClose={() => setBookServiceOpen(false)}
          onBooked={() => fetchDashboard(true)}
        />
      )}
      {reportJobId !== null && (
        <ServiceReportModal jobId={reportJobId} onClose={() => setReportJobId(null)} />
      )}
      {confirmModal && (
        <ConfirmModal data={confirmModal} onClose={() => setConfirmModal(null)} />
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

// Shared animated modal wrapper

function Modal({
  onClose,
  children,
  panelClassName = "w-full max-w-md",
}: {
  onClose: () => void;
  children: (args: { close: () => void }) => React.ReactNode;
  panelClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 150);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      <div
        className={`${panelClassName} rounded-xl border bg-card p-6 shadow-xl transition-all duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children({ close })}
      </div>
    </div>
  );
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" /> Call Shop Now
          </a>
        </>
      )}
    </Modal>
  );
}

// Full History modal

function HistoryModal({ activities, onClose }: { activities: DashboardActivity[]; onClose: () => void }) {
  const activityMeta = (type: DashboardActivity["type"]) => {
    switch (type) {
      case "payment":
        return { icon: CreditCard, color: "text-success" };
      case "progress_log":
        return { icon: Wrench, color: "text-brand" };
      case "status_change":
        return { icon: RefreshCw, color: "text-warning" };
      case "booking_accepted":
        return { icon: CheckCircle2, color: "text-success" };
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

  return (
    <Modal onClose={onClose} panelClassName="w-full max-w-lg max-h-[80vh] overflow-y-auto">
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">Full Activity History</h3>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity history yet.</p>
            ) : (
              activities.map((act) => {
                const meta = activityMeta(act.type);
                return (
                  <Activity
                    key={`hist-${act.type}-${act.id}`}
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
        </>
      )}
    </Modal>
  );
}

// Book New Service modal — ported from the public /book page (BookPage) so the
// dashboard flow matches it field-for-field, just shown as a modal instead of
// a standalone route with its own Header/Footer.

// Book New Service modal — single-page form matching the /dashboard/register-vehicle layout.

const BOOK_CATEGORIES = [
  "Oil Change", "Brake Service", "Engine Diagnostics", "Tire Replacement",
  "Aircon Repair", "General Maintenance", "Car Wash & Detailing",
];
const BOOK_OTHERS = "Others";
const BOOK_VEHICLE_MAKES = [
  "Toyota", "Honda", "Mitsubishi", "Ford", "Nissan", "Hyundai", "Kia",
  "Suzuki", "Isuzu", "Mazda", "Chevrolet", "Subaru", "Volkswagen",
  "BMW", "Mercedes-Benz", "Peugeot", "Geely", "Chery", "MG",
];
const BOOK_YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));

// onBooked fires once a booking succeeds so the dashboard behind the modal
// refetches — the new Pending Request should be there when the modal closes,
// not after a manual refresh.
function BookServiceModal({ onClose, onBooked }: { onClose: () => void; onBooked: () => void }) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Plate of a car that already has an open job order — shows a modal instead
  // of a browser alert when the customer tries to book it again.
  const [inServicePlate, setInServicePlate] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeJobOrders, setActiveJobOrders] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleTransmission, setVehicleTransmission] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [plateError, setPlateError] = useState<string | undefined>(undefined);

  const [pickup, setPickup] = useState<"shop" | "home">("shop");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceCategoryOther, setServiceCategoryOther] = useState("");
  const [notes, setNotes] = useState("");
  // Explicit agreement to the OBD-II scan fee when the category needs it.
  const [scanAcknowledged, setScanAcknowledged] = useState(false);
  const needsScan = requiresDiagnosticScan(serviceCategory);

  useEffect(() => {
    const userId = sessionStorage.getItem("autokita_user_id");
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch(`/api/dashboard?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        if (data.vehicles) setVehicles(data.vehicles);
        if (data.activeJobOrders) setActiveJobOrders(data.activeJobOrders);
        if (!data.vehicles || data.vehicles.length === 0) setSelectedVehicleId("new");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data", err);
        setLoading(false);
      });
  }, []);

  const isVehicleActive = (plate: string) => activeJobOrders.some((jo) => jo.plate_number === plate);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    const userId = sessionStorage.getItem("autokita_user_id");
    if (!userId) {
      alert("You must be logged in to book a service.");
      return;
    }
    if (!selectedVehicleId) {
      alert('Please select a vehicle, or choose "+ Register New Vehicle".');
      return;
    }
    if (needsScan && !scanAcknowledged) {
      toast.error("Please agree to the diagnostic scan fee to continue.");
      return;
    }
    if (serviceCategory === BOOK_OTHERS && !serviceCategoryOther.trim()) {
      toast.error("Please describe the service you need.");
      return;
    }

    const category = serviceCategory === BOOK_OTHERS ? serviceCategoryOther.trim() : serviceCategory;
    const reqBody: any = {
      userId: parseInt(userId, 10),
      serviceMode: pickup === "shop" ? "Shop Visit" : "Home Service",
      customerConcern: `Category: ${category || "Not specified"}. Notes: ${notes || "None"}`,
      homeAddress: user?.address || "None",
      diagnosticScanAuthorized: needsScan && scanAcknowledged,
    };

    if (selectedVehicleId === "new") {
      if (!vehicleModel || !vehiclePlate) {
        alert("Please provide the new vehicle's model and license plate.");
        return;
      }
      if (!isValidPhPlate(vehiclePlate)) {
        setPlateError(PLATE_FORMAT_ERROR);
        return;
      }
      if (isVehicleActive(vehiclePlate)) {
        setInServicePlate(vehiclePlate);
        return;
      }
      reqBody.newVehicleDetails = {
        make: vehicleMake || null,
        model: vehicleModel,
        year: vehicleYear || new Date().getFullYear().toString(),
        type: vehicleTransmission || "Sedan",
        mileage: vehicleMileage || "0",
        plate: vehiclePlate,
      };
    } else {
      reqBody.vehicleId = parseInt(selectedVehicleId, 10);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customer/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (data.success) {
        setShowConfirmModal(true);
        onBooked();
      } else {
        alert("Booking failed: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while confirming your booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVehicleDetails =
    selectedVehicleId === "new" ? null : vehicles.find((v) => v.id.toString() === selectedVehicleId);
  const displayVehicle = selectedVehicleDetails
    ? `${selectedVehicleDetails.vehicle_model} (${selectedVehicleDetails.plate_number})`
    : vehicleModel
    ? `${vehicleModel} (${vehiclePlate || "—"})`
    : "—";

  const userFullName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.nickname : "Guest";
  const userContact = user?.contact_number || "—";
  const userEmail = user?.email || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-8" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-xl border bg-card p-6 shadow-2xl md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Book New Service</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Register a vehicle or pick an existing one to schedule your visit.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              <BookModalCard icon={User} title="Customer Details" subtitle="Review your contact details for this booking.">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Full Name</label>
                  <input value={userFullName} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Contact Number</label>
                    <input value={userContact} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">Email Address</label>
                    <input value={userEmail} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
                  </div>
                </div>
              </BookModalCard>

              <BookModalCard icon={Car} title="Vehicle Details" subtitle="Select an existing vehicle or register a new one.">
                <div className="mb-4">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Select Vehicle</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                  >
                    <option value="" disabled>
                      {" "}Select a vehicle...
                    </option>
                    {vehicles.map((v) => {
                      const isActive = activeJobOrders.some((jo) => jo.plate_number === v.plate_number);
                      return (
                        <option key={v.id} value={v.id.toString()} disabled={isActive}>
                          {v.vehicle_model} ({v.plate_number}) {isActive ? " - Currently in Job Order" : ""}
                        </option>
                      );
                    })}
                    <option value="new">+ Register New Vehicle</option>
                  </select>
                  {selectedVehicleId === "" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Choose one of your saved vehicles, or register a new one.
                    </p>
                  )}
                </div>

                {selectedVehicleId === "new" && (
                  <>
                    <div className="mb-4 h-px bg-border" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <BookModalSelect
                        label="Vehicle Make (Brand)"
                        placeholder="Select Brand"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        options={BOOK_VEHICLE_MAKES}
                      />
                      <BookModalInput
                        label="Vehicle Model"
                        placeholder="e.g., Vios, Civic, Montero"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                      />
                      <BookModalSelect
                        label="Year"
                        placeholder="Select Year"
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value)}
                        options={BOOK_YEARS}
                      />
                      <BookModalSelect
                        label="Transmission"
                        placeholder="Select Transmission"
                        value={vehicleTransmission}
                        onChange={(e) => setVehicleTransmission(e.target.value)}
                        options={["Automatic", "Manual"]}
                      />
                      <BookModalInput
                        label="Mileage"
                        placeholder="e.g., 50000"
                        type="number"
                        value={vehicleMileage}
                        onChange={(e) => setVehicleMileage(e.target.value)}
                      />
                      <BookModalInput
                        label="License Plate"
                        placeholder="e.g., ABC-1234"
                        wide
                        value={vehiclePlate}
                        onChange={(e) => { setVehiclePlate(e.target.value); setPlateError(undefined); }}
                        error={plateError}
                      />
                    </div>
                  </>
                )}
              </BookModalCard>

              <BookModalCard icon={Wrench} title="Service Preferences" subtitle="Tell us what your vehicle needs and where.">
                <label className="text-sm font-medium">Type of Service</label>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <BookRadioTile icon={MapPin} label="Shop Visit" active={pickup === "shop"} onClick={() => setPickup("shop")} />
                  <BookRadioTile icon={Car} label="Home Service" active={pickup === "home"} onClick={() => setPickup("home")} />
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Service Category</label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => { setServiceCategory(e.target.value); setScanAcknowledged(false); }}
                    className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                  >
                    <option value="">Select a Service</option>
                    {BOOK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={BOOK_OTHERS}>Others (type your own)</option>
                  </select>
                  {serviceCategory === BOOK_OTHERS && (
                    <input
                      value={serviceCategoryOther}
                      onChange={(e) => setServiceCategoryOther(e.target.value)}
                      placeholder="Please describe the service you need"
                      autoFocus
                      className="mt-2 w-full rounded-md border border-brand/50 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                    />
                  )}
                </div>

                {/* Scanner-fee disclosure — same rule and wording as the public
                    booking page. Confirm is blocked until it's agreed to. */}
                {needsScan && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-950">
                          Scan fee: {formatPeso(DIAGNOSTIC_SCAN_FEE)}
                        </p>
                        <p className="mt-1 text-sm text-amber-900">
                          To find the problem, we will plug a scanner into your car. You will pay this fee{" "}
                          <b>even if you decide not to push through with the repair</b>. Repairs are priced
                          separately, and we&apos;ll ask you first.
                        </p>
                        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-amber-950">
                          <input
                            type="checkbox"
                            checked={scanAcknowledged}
                            onChange={(e) => setScanAcknowledged(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-600"
                          />
                          <span>I agree to pay the {formatPeso(DIAGNOSTIC_SCAN_FEE)} scan fee.</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <label className="text-sm font-medium">Additional Notes or Concerns</label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe any specific issues (e.g., strange noises, warning lights)..."
                    className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </BookModalCard>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-brand" />
                  <h3 className="font-semibold">Booking Summary</h3>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <BookSumRow label="Customer Name" value={userFullName} />
                  <BookSumRow label="Vehicle" value={displayVehicle} />
                  <BookSumRow label="Service Option" value={pickup === "shop" ? "Shop Visit" : "Home Service"} />
                  <BookSumRow label="Service Needed" value={serviceCategory || "—"} />
                </div>
              </div>

              <div className="rounded-xl bg-brand p-4 text-brand-foreground">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <AlertCircle className="h-4 w-4" /> NOTE TO CUSTOMER
                </div>
                <p className="mt-2 text-xs text-white/85">
                  Please ensure you have the vehicle's registration documents ready for the mechanic's verification.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border bg-card p-4 text-center">
                  <Calendar className="mx-auto h-4 w-4 text-brand" />
                  <div className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">Availability</div>
                  <div className="text-sm font-bold">24h Response</div>
                </div>
                <div className="rounded-xl border bg-card p-4 text-center">
                  <ShieldCheck className="mx-auto h-4 w-4 text-brand" />
                  <div className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">Warranty</div>
                  <div className="text-sm font-bold">6 Months</div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {!loading && (
          <div className="mt-8 flex justify-end gap-3 border-t pt-6">
            <button onClick={onClose} className="rounded-md border px-5 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || (needsScan && !scanAcknowledged)}
              title={needsScan && !scanAcknowledged ? "Agree to the diagnostic scan fee first" : undefined}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </button>
          </div>
        )}
      </div>

      {inServicePlate && (
        <VehicleInServiceModal plate={inServicePlate} onClose={() => setInServicePlate(null)} />
      )}

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowConfirmModal(false);
            onClose();
          }}
        >
          <div className="w-full max-w-sm rounded-xl bg-card p-6 text-center shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Booking Confirmed!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your vehicle registration and service request have been submitted. We'll notify you once it's reviewed.
            </p>
            <button
              onClick={() => {
                setShowConfirmModal(false);
                onClose();
              }}
              className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookModalCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: any;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BookModalInput({
  label,
  wide,
  error,
  ...p
}: { label: string; wide?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <input
        {...p}
        className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${
          error ? "border-rose-400 focus:border-rose-400" : "focus:border-brand"
        }`}
      />
      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}

function BookModalSelect({
  label,
  placeholder,
  options,
  ...p
}: { label: string; placeholder: string; options?: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <select {...p} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none">
        <option value="">{placeholder}</option>
        {options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function BookRadioTile({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md border p-3 text-sm transition ${
        active ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-muted-foreground"}`}>
        {active && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      <Icon className="h-4 w-4 text-brand" /> {label}
    </button>
  );
}

function BookSumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] line-clamp-2">{value || "—"}</span>
    </div>
  );
}

// Service Report modal — shown for completed/released job orders instead of the tracker.
// Reuses the same data source as the Completed tracking page so the numbers always match.

function formatDashboardLogTime(iso: string | null | undefined) {
  return formatStamp(iso);
}

type ReportTimelineEntry = {
  key: string;
  label: string;
  detail?: string;
  time?: string | null;
  status: "completed" | "active" | "pending";
  image?: string;
};

// Same milestone shape as the In Progress tracker's Service Timeline, just
// built from completed-job-order data (logs instead of live tasks). Optional
// per-stage timestamps (inspection_completed_at, quotation_prepared_at,
// downpayment_received_at, released_at, release_photo_url) aren't in the
// CompletedData type yet — add them to getCompletedData once wired up.
function buildReportTimeline(data: Awaited<ReturnType<typeof getCompletedData>>): ReportTimelineEntry[] {
  const { jobOrder, logs } = data;
  if (!jobOrder) return [];
  const jo: any = jobOrder;
  const isReleased = jobOrder.status === "released";

  return [
    {
      key: "received",
      label: "Vehicle Received",
      detail: `${jobOrder.vehicle_year} ${jobOrder.vehicle_model} checked in at the shop.`,
      time: formatDashboardLogTime(jo.date_arrived) || null,
      status: "completed",
    },
    {
      key: "inspecting",
      label: "Mechanic Inspecting Vehicle",
      detail: "Technician performed the pre-diagnostic inspection.",
      time: formatDashboardLogTime(jo.date_arrived) || null,
      status: "completed",
    },
    {
      key: "inspection_completed",
      label: "Inspection Completed",
      detail: "Findings logged and quotation drafting started.",
      time: formatDashboardLogTime(jo.inspection_completed_at) || null,
      status: "completed",
    },
    {
      key: "quotation_prepared",
      label: "Quotation Prepared",
      detail: "Service quotation was sent for your review.",
      time: formatDashboardLogTime(jo.quotation_prepared_at) || null,
      status: "completed",
    },
    {
      key: "downpayment",
      label: "Downpayment / Confirmation Received",
      detail: "Quotation confirmed and servicing authorized.",
      time: formatDashboardLogTime(jo.downpayment_received_at) || null,
      status: "completed",
    },
    ...logs.map((log) => ({
      key: `log-${log.id}`,
      label: log.activity_description,
      time: formatDashboardLogTime(log.log_time),
      status: "completed" as const,
    })),
    {
      key: "service_completed",
      label: "Vehicle Service Completed",
      detail: "All confirmed services finished by our technicians.",
      time: null,
      status: "completed",
    },
    {
      key: "payment_received",
      label: "Payment Received",
      detail: "Final billing settled for this job order.",
      time: null,
      status: Number(jobOrder.balance) <= 0 ? "completed" : "pending",
    },
    {
      key: "released",
      label: "Vehicle Released",
      detail: "Vehicle handed back to the customer.",
      time: formatDashboardLogTime(jo.released_at) || null,
      status: isReleased ? "completed" : "pending",
      image: jo.release_photo_url,
    },
  ];
}

function ServiceReportModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompletedData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id")) || CURRENT_USER_ID;
    getCompletedData(userId, jobId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [jobId]);

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!data?.jobOrder) return;
    setDownloading(true);
    const pdfData = await fetchJobOrderPdfData(data.jobOrder.job_order_id);
    setDownloading(false);
    if (!pdfData) return;
    void generateJobOrderPdf(pdfData);
  };

  return (
    <Modal onClose={onClose} panelClassName="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">Service Report</h3>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : error || !data?.jobOrder ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Report not available for this service yet.</p>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-brand-soft/40 p-4 text-sm">
                <div className="font-semibold">
                  {data.jobOrder.vehicle_year} {data.jobOrder.vehicle_model} — {data.jobOrder.plate_number}
                </div>
                <div className="text-xs text-muted-foreground">Job Order #JO-{data.jobOrder.job_order_id}</div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Timeline</div>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    {buildReportTimeline(data).length} Milestones
                  </span>
                </div>
                <div className="mt-3">
                  {buildReportTimeline(data).map((entry, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const badgeLabel = entry.status === "completed" ? "Completed" : entry.status === "active" ? "Active" : "Pending";
                    const badgeClasses =
                      entry.status === "completed"
                        ? "bg-success/15 text-[color:oklch(0.5_0.16_145)]"
                        : entry.status === "active"
                        ? "bg-brand-soft text-brand"
                        : "bg-muted text-muted-foreground";

                    return (
                      <div key={entry.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              entry.status === "completed"
                                ? "border-muted-foreground/40 bg-background"
                                : entry.status === "active"
                                ? "border-brand bg-background"
                                : "border-muted-foreground/20 bg-background"
                            }`}
                          >
                            {entry.status === "active" && (
                              <>
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
                                <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                              </>
                            )}
                            {entry.status === "completed" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
                            )}
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-border" />}
                        </div>

                        <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                          <div className="flex w-full items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{entry.label}</div>
                              {entry.detail && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>
                              )}
                              {entry.time && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {entry.time}
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}>
                              {badgeLabel}
                            </span>
                          </div>

                          {entry.key === "released" && entry.image && (
                            <img
                              src={entry.image}
                              alt="Vehicle release proof"
                              className="mt-2 aspect-video w-full max-w-sm rounded-lg border object-cover"
                            />
                          )}
                          {entry.key === "released" && !entry.image && entry.status !== "completed" && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Camera className="h-3 w-3" /> Release photo will appear here once the vehicle is handed back.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="font-semibold">Technician Labor</div>
                {data.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-muted-foreground">
                    <span>{s.service_name}</span>
                    <span>₱{formatMoney(s.actual_amount)}</span>
                  </div>
                ))}
                <div className="mt-3 font-semibold">Replaced Parts</div>
                {data.parts.map((p) => (
                  <div key={p.id} className="flex justify-between text-muted-foreground">
                    <span>{p.description} x{p.quantity}</span>
                    <span>₱{formatMoney(p.total_retail_amount)}</span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">₱{formatMoney(data.bill?.total)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Paid (verified)</span>
                  <span>− ₱{formatMoney(data.bill?.paid)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Balance Due</span>
                  <span className={`text-lg font-bold ${(data.bill?.balance ?? 0) > 0 ? "text-teal" : "text-success"}`}>₱{formatMoney(data.bill?.balance)}</span>
                </div>
              </div>

              {(data.bill?.balance ?? 0) > 0 && (
                <Link
                  href={`/dashboard/tracking/billing?jobOrderId=${jobId}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  <CreditCard className="h-4 w-4" /> Pay Remaining Balance
                </Link>
              )}

              {data.warranties.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Warranties</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {data.warranties.map((w) => (
                      <div key={w.id} className="flex items-center justify-between">
                        <span>{w.coverage_description}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-teal" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Job Order
              </button>
            </>
          )}
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
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
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
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.98] ${confirmClasses}`}
            >
              {data.confirmLabel}
            </button>
            <button
              onClick={close}
              className="flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-accent"
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
}: {
  model: string;
  plate: string;
  type: string;
  inService?: boolean;
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
    </div>
  );
}

function Alert({
  tone,
  title,
  badge,
  body,
  actions,
}: {
  tone: "destructive" | "neutral" | "success";
  title: string;
  badge: string;
  body: string;
  actions?: React.ReactNode;
}) {
  const toneMap = {
    destructive: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-muted/30",
    success: "border-success/30 bg-success/5",
  };
  const iconMap = {
    destructive: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
    neutral: <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  };
  return (
    <div className={`rounded-md border p-3 transition-shadow duration-200 hover:shadow-sm ${toneMap[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {iconMap[tone]} {title}
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">{badge}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
      {actions && <div className="mt-3 flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export default Dashboard;