'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Wrench,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  MapPin,
  PackageCheck,
  Search,
  CreditCard,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type {
  DashboardData,
  DashboardActivity,
  DashboardJobOrder,
  DashboardShop,
} from "@/controllers/dashboardController";

const heroCar = "/assets/ac/a1.jpg"; 

// Status 
const STATUS_TO_STEP: Record<string, number> = {
  inspecting:                 1,
  pending_customer_approval:  2,
  revision_pending:           2,
  waiting_on_parts:           3,
  in_progress:                3,
  completed:                  4,
  released:                   4,
};

const STATUS_LABEL: Record<string, string> = {
  inspecting:                 "Under Inspection",
  pending_customer_approval:  "Pending Approval",
  revision_pending:           "Revision Pending",
  waiting_on_parts:           "Waiting on Parts",
  in_progress:                "In Progress",
  completed:                  "Completed",
  released:                   "Released",
};

// The currently "logged in" demo customer — matches user_id 280 in the DB.
const CURRENT_USER_ID = 280;

function Dashboard() {
  useEffect(() => { document.title = "Dashboard — AutoKita"; }, []);

  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

  // Dynamic data from PostgreSQL 
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string>("");

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  // Activity icon/colour helpers
  const activityMeta = (type: DashboardActivity["type"]) => {
    switch (type) {
      case "payment":
        return { icon: CreditCard, color: "text-success" };
      case "progress_log":
        return { icon: Wrench, color: "text-brand" };
      case "status_change":
        return { icon: RefreshCw, color: "text-warning" };
      default:
        return { icon: FileText, color: "text-muted-foreground" };
    }
  };

  // Loading / error states
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="mt-4 text-sm text-muted-foreground">{error ?? "No data"}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  const { user, vehicles, activeJobOrders, recentActivity, shop } = data;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
         
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-brand via-brand to-[color:oklch(0.22_0.05_250)] p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

            <img
              src={heroCar}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full object-cover object-top opacity-40 mix-blend-luminosity"
            />

            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/70">Welcome back</div>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl animate-fade-up">
                Hello, {user ? `${user.first_name} ${user.last_name}` : "Customer"} 👋
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-white/85">
                {user && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {user.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {user.contact_number}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-4 max-w-md text-sm text-white/80">
                Your vehicles are being looked after. Here&apos;s what&apos;s happening today.
              </p>
            </div>
          </section>

         
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Services</h2>
              <span className="text-xs text-muted-foreground">
                Last synced: Today, {lastSynced || "—"}
              </span>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {activeJobOrders.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active services yet — book one from the button above.
                </div>
              ) : (
                activeJobOrders.map((job) => (
                  <ServiceCard
                    key={job.id}
                    vehicle={`${job.vehicle_year} ${job.vehicle_model}`}
                    jobOrderId={`#JO-${job.id}`}
                    status={STATUS_LABEL[job.status] ?? job.status}
                    note={job.service_name ?? "Service"}
                    stepIndex={STATUS_TO_STEP[job.status] ?? 0}
                  />
                ))
              )}
            </div>
          </section>

          
          <section>
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Activity</h2>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  View Full History
                </button>
              </div>
              <div className="mt-5 space-y-5">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity.</p>
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
          </section>
        </div>

        <aside className="space-y-6">

          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</div>
            <div className="mt-4 space-y-2">
              <Link
                href="/dashboard/register-vehicle"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Book New Service
              </Link>
              <button
                onClick={() => setContactOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-transform duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" /> Contact Shop Office
              </button>
            </div>
          </div>

          
          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Vehicles</div>
            <div className="mt-4 space-y-3">
              {vehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No vehicles registered yet.</p>
              ) : (
                vehicles.map((v) => (
                  <VehicleRow
                    key={v.id}
                    model={`${v.vehicle_year} ${v.vehicle_model}`}
                    plate={v.plate_number}
                    type={v.vehicle_type}
                  />
                ))
              )}
              <Link
                href="/dashboard/register-vehicle"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-brand hover:bg-accent hover:text-brand"
              >
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" /> Register New Vehicle
              </Link>
            </div>
          </div>

          {/* CONTEXTUAL ALERTS — from recent activity */}
          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contextual Alerts</div>
            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts at this time.</p>
              ) : (
                recentActivity.slice(0, 3).map((act) => {
                  const tone: "destructive" | "neutral" | "success" =
                    act.type === "status_change"
                      ? "destructive"
                      : act.type === "payment"
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
        </aside>
      </div>

      {contactOpen && <ContactShopModal shop={shop} onClose={() => setContactOpen(false)} />}
      {historyOpen && <HistoryModal activities={recentActivity} onClose={() => setHistoryOpen(false)} />}
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
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
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

// Service card with car-icon stepper

const SERVICE_STEPS = [
  { label: "Received", icon: PackageCheck },
  { label: "Inspecting", icon: Search },
  { label: "Quotation", icon: FileText },
  { label: "In Progress", icon: Wrench },
  { label: "Completed", icon: CheckCircle2 },
];

function ServiceCard({
  vehicle,
  jobOrderId,
  status,
  note,
  stepIndex,
}: {
  vehicle: string;  
  jobOrderId: string;
  status: string;
  note: string;
  stepIndex: number; 
}) {
  return (
    <div className="group overflow-hidden rounded-xl border bg-card transition-shadow duration-300 hover:shadow-lg">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              Active Booking
            </span>
            <span className="text-[10px] text-muted-foreground">{jobOrderId}</span>
          </div>
          <Wrench className="h-4 w-4 text-brand" />
        </div>

        <div className="mt-3 text-lg font-bold">{vehicle}</div>
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Status: </span>
          <b>{status}</b>
        </div>

        
        <div className="mt-6 flex items-start">
          {SERVICE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < stepIndex;
            const isCurrent = i === stepIndex;
            const isActive = isDone || isCurrent;
            return (
              <div key={step.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative flex h-7 w-7 items-center justify-center">
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
  className={`text-center text-[6.5px] font-semibold uppercase leading-tight tracking-tighter transition-colors duration-300 ${
    isActive ? "text-brand" : "text-muted-foreground"
  }`}
>
  {step.label}
</span>
                </div>
                {i < SERVICE_STEPS.length - 1 && (
                  <div className={`-mt-5 h-0.5 flex-1 transition-colors duration-300 ${isDone ? "bg-brand" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> Service: {note}
        </div>
        <Link
          href="/dashboard/tracking/received"
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-md bg-[color:oklch(0.22_0.05_250)] py-2 text-xs font-medium text-white transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          View Full Tracking{" "}
          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
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
    <div className="flex gap-3">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{time}</div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function VehicleRow({ model, plate, type }: { model: string; plate: string; type: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-md border bg-muted/30 p-2.5 transition-colors hover:bg-muted/60">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand/10 text-brand">
        <Wrench className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{model}</div>
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
