'use client'

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  AlertCircle,
  Info,
  X,
  Wrench,
  CheckCircle2,
  Loader2,
  Wallet,
  Store,
  Send,
  CreditCard,
  Camera,
  Download,
  Upload,
  ShieldCheck,
} from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getInProgressData } from "@/controllers/serviceProgressController";
// Billing & Warranty was previously its own page/route — its exact UI/logic
// (itemized parts/labor breakdown, payment method chooser, invoice download)
// now lives inline on this tracking stage instead, scoped to this job order.
import {
  type Service,
  type Warranty,
  CATEGORY_ORDER,
  STATUS_STYLE,
  WARRANTY_STATUS_STYLE,
  peso,
  serviceTotal,
} from "@/data/billings";
import { getServices, getWarranties } from "@/controllers/billingController";

type Task = {
  id: number;
  section_id: string;
  task_title: string;
  note: string;
  task_status: string;
  completed_at: string | null;
  price: string;
  billable: boolean;
  scheduled_date?: string;
  estimated_finish?: string;
};

type JobOrder = {
  job_order_id: number;
  status: string;
  quotation_approved: boolean;
  started_at: string;
  date_promised: string;
  estimated_duration: string;
  actual_duration: string;
  actual_grand_total: string;
  balance: string;
  vehicle_model: string;
  vehicle_year: number;
  plate_number: string;
  // Optional milestone timestamps — wire these up on the backend as they
  // become available so the unified Service Timeline below can show them.
  date_arrived?: string;
  inspection_completed_at?: string;
  quotation_prepared_at?: string;
  downpayment_received_at?: string;
  released_at?: string;
  release_photo_url?: string;
};

type TimelineEntry = {
  key: string;
  label: string;
  detail?: string;
  time?: string | null;
  status: "completed" | "active" | "pending";
  image?: string;
};

function getTag(status: string): "completed" | "active" | "pending" {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "active";
  return "pending";
}

function InProgress() {
  useEffect(() => { document.title = "In Progress — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<{ jobOrder: JobOrder | null; tasks: Task[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWarn, setShowWarn] = useState(false);
  const [pullOutStatus, setPullOutStatus] = useState<"none" | "requested">("none");
  const [pullOutNote, setPullOutNote] = useState("");

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getInProgressData(userId, jobOrderId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const tasks = data?.tasks ?? [];
  const jobOrder = data?.jobOrder ?? null;

  // Locked once the job order has moved past active servicing — the
  // "Pull Out Vehicle" action no longer makes sense and must stay disabled.
  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

  const [aiTime, setAiTime] = useState<{
    predicted_hours: number;
    predicted_duration_mins: number;
    services?: { service_name: string; predicted_duration_mins: number }[];
  } | null>(null);

  useEffect(() => {
    if (!jobOrder) return;
    fetch(`/api/predict/time?jobOrderId=${jobOrder.job_order_id}`)
      .then(r => r.json())
      .then(d => { if (d.predicted_hours) setAiTime(d); })
      .catch(() => {});
  }, [jobOrder]);

  const completedBillable = tasks.filter(
    (t) => getTag(t.task_status) === "completed" && t.billable
  );
  const payableTotal = completedBillable.reduce(
    (sum, t) => sum + parseFloat(t.price || "0"),
    0
  );

  const completionPct = tasks.length
    ? Math.round(
        (tasks.filter((t) => getTag(t.task_status) === "completed").length / tasks.length) * 100
      )
    : 0;

  // --- Unified Service Timeline -----------------------------------------
  // Combines job-order-level milestones (received → inspecting → quotation →
  // downpayment → per-task work → completed/released) into a single list.
  // Milestone timestamps that aren't in the DB yet fall back gracefully so
  // the timeline still renders something sensible while the backend catches up.
  const timeline: TimelineEntry[] = jobOrder
    ? [
        {
          key: "received",
          label: "Vehicle Received",
          detail: `${jobOrder.vehicle_year} ${jobOrder.vehicle_model} checked in at the shop.`,
          time: jobOrder.date_arrived ?? null,
          status: "completed",
        },
        {
          key: "inspecting",
          label: "Mechanic Inspecting Vehicle",
          detail: "Technician performed the pre-diagnostic inspection.",
          time: jobOrder.date_arrived ?? null,
          status: "completed",
        },
        {
          key: "inspection_completed",
          label: "Inspection Completed",
          detail: "Findings logged and quotation drafting started.",
          time: jobOrder.inspection_completed_at ?? null,
          status: "completed",
        },
        {
          key: "quotation_prepared",
          label: "Quotation Prepared",
          detail: "Service quotation was sent for your review.",
          time: jobOrder.quotation_prepared_at ?? null,
          status: "completed",
        },
        {
          key: "downpayment",
          label: jobOrder.quotation_approved ? "Downpayment / Confirmation Received" : "Awaiting Confirmation",
          detail: jobOrder.quotation_approved
            ? "Quotation confirmed and servicing authorized."
            : "Waiting for customer to confirm the quotation.",
          time: jobOrder.downpayment_received_at ?? null,
          status: jobOrder.quotation_approved ? "completed" : "pending",
        },
        ...tasks.map((t) => ({
          key: `task-${t.id}`,
          label: t.task_title,
          detail: t.note && t.note !== "Describe the service..." ? t.note : undefined,
          time: t.completed_at ?? t.scheduled_date ?? null,
          status: getTag(t.task_status),
        })),
        {
          key: "service_completed",
          label: "Vehicle Service Completed",
          detail: "All confirmed services finished by our technicians.",
          time: isHistorical ? (jobOrder.date_promised ?? null) : null,
          status: isHistorical ? "completed" : completionPct === 100 ? "completed" : "pending",
        },
        {
          key: "payment_received",
          label: "Payment Received",
          detail: "Final billing settled for this job order.",
          time: null,
          status: Number(jobOrder.balance) <= 0 && isHistorical ? "completed" : "pending",
        },
        {
          key: "released",
          label: "Vehicle Released",
          detail: "Vehicle handed back to the customer.",
          time: jobOrder.released_at ?? null,
          status: jobOrder.status === "released" ? "completed" : "pending",
          image: jobOrder.release_photo_url,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading service progress…
        </div>
      </div>
    );
  }

  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You don't have any vehicle currently in service.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="in-progress" jobOrderId={jobOrder.job_order_id} />

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This service has already been completed. You're viewing a read-only record.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between border-l-4 border-brand pl-3">
              <h2 className="text-xl font-bold">Service Timeline</h2>
              <span className="rounded-md border px-2.5 py-1 text-xs font-semibold">
                {timeline.length} Milestones
              </span>
            </div>

            <div className="mt-4">
              {timeline.map((entry, idx) => {
                const isLast = idx === timeline.length - 1;
                const isOnHold = pullOutStatus === "requested" && entry.status !== "completed" && entry.key.startsWith("task-");

                const badgeLabel = isOnHold
                  ? "On Hold"
                  : entry.status === "completed"
                  ? "Completed"
                  : entry.status === "active"
                  ? "Active"
                  : "Pending";
                const badgeClasses = isOnHold
                  ? "bg-destructive/15 text-destructive"
                  : entry.status === "completed"
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
                            : isOnHold
                            ? "border-destructive bg-background"
                            : entry.status === "active"
                            ? "border-brand bg-background"
                            : "border-muted-foreground/20 bg-background"
                        }`}
                      >
                        {entry.status === "active" && !isOnHold && (
                          <>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
                            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                          </>
                        )}
                        {isOnHold && <X className="h-3.5 w-3.5 text-destructive" strokeWidth={2.5} />}
                        {entry.status === "completed" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
                        )}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border" />}
                    </div>

                    <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"} ${isOnHold ? "opacity-70" : ""}`}>
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
                        <span
                          className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}
                        >
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
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-brand p-5 text-brand-foreground">
            <div className="text-3xl font-bold">{completionPct}%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              Overall Completion
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${completionPct}%` }} />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Started
                </span>
                <b>
                  {(() => {
                    const startedRaw = jobOrder.started_at || (tasks.filter(t => t.task_status !== 'pending').length > 0
                      ? (() => {
                          const firstTask = [...tasks]
                            .filter(t => t.task_status !== 'pending')
                            .sort((a, b) => {
                              const dateA = a.scheduled_date || a.completed_at || '';
                              const dateB = b.scheduled_date || b.completed_at || '';
                              return new Date(dateA).getTime() - new Date(dateB).getTime();
                            })[0];
                          return firstTask?.scheduled_date || firstTask?.completed_at;
                        })()
                      : null);
                    
                    return startedRaw ? new Date(startedRaw).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not yet started';
                  })()}
                </b>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Estimated Finish
                </span>
                <b>
                  {(() => {
                    const allScheduled = tasks.length > 0 && tasks.every(t => t.scheduled_date || t.completed_at);
                    if (allScheduled && aiTime?.predicted_duration_mins) {
                       const maxDate = new Date(Math.max(...tasks.map(t => new Date(t.scheduled_date || t.completed_at || 0).getTime())));
                       
                       // Find all tasks that happen on the same day as the maxDate (the last day of service)
                       const lastDayString = maxDate.toDateString();
                       const lastDayTasks = tasks.filter(t => {
                         const d = new Date(t.scheduled_date || t.completed_at || 0);
                         return d.toDateString() === lastDayString;
                       });
                       
                       // Sum the AI predicted duration for these specific tasks
                       let additionalMins = 0;
                       if (aiTime.services) {
                         for (const task of lastDayTasks) {
                           const servicePred = aiTime.services.find((s: any) => s.service_name === task.task_title);
                           if (servicePred) {
                             additionalMins += servicePred.predicted_duration_mins;
                           }
                         }
                       }
                       // Fallback if no specific services match or no services available
                       if (additionalMins === 0) {
                          additionalMins = Math.max(60, Math.round(aiTime.predicted_duration_mins / tasks.length));
                       }
                       
                       maxDate.setMinutes(maxDate.getMinutes() + additionalMins);
                       return maxDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                    }
                    return jobOrder.date_promised ? new Date(jobOrder.date_promised).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not scheduled';
                  })()}
                </b>
              </div>
            </div>
            <div className="mt-4 border-t border-white/20 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Labor Hours (Est.)</span>
                <b>{jobOrder.estimated_duration}</b>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Current Duration</span>
                <b>{jobOrder.actual_duration}</b>
              </div>
            </div>
          </div>

          {/* --- Billing (moved in from the standalone Billing & Warranty page) --- */}
          <BillingSection jobOrder={jobOrder} />

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="h-4 w-4 text-teal" /> Assigned Team
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your vehicle is being serviced by a certified AutoKita technician.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Vehicle Actions
            </div>

            {isHistorical ? (
              <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                This service has been completed. Vehicle actions are no longer available.
              </div>
            ) : pullOutStatus === "requested" ? (
              <div className="mt-3 rounded-lg bg-warning/15 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:oklch(0.55_0.15_60)]">
                  <Info className="h-4 w-4" /> Pull-Out Requested
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your admin has been notified. You'll be billed only for the{" "}
                  {completedBillable.length} completed service
                  {completedBillable.length !== 1 ? "s" : ""} (₱{payableTotal.toLocaleString()})
                  once approved.
                </p>
                {pullOutNote && (
                  <div className="mt-2 rounded-md bg-background/60 p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Your Note
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{pullOutNote}</p>
                  </div>
                )}
                <button
                  onClick={() => {
                    setPullOutStatus("none");
                    setPullOutNote("");
                  }}
                  className="mt-3 w-full rounded-md border py-2 text-xs font-semibold hover:bg-accent"
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-lg bg-[color:oklch(0.97_0.04_10)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:oklch(0.55_0.2_10)]">
                  <AlertCircle className="h-4 w-4" /> Approval Required
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Manage your vehicle's current service session.
                </p>
                <button
                  onClick={() => setShowWarn(true)}
                  className="mt-3 w-full rounded-md bg-[color:oklch(0.6_0.22_350)] py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Pull Out Vehicle
                </button>
              </div>
            )}

            {!isHistorical && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 font-semibold">
                  <Info className="h-3 w-3" /> Note
                </div>
                <p className="mt-1">
                  Use this to request pulling your vehicle out of service. Only completed work will
                  be charged; ongoing and pending services will be cancelled.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showWarn && !isHistorical && (
        <PullOutModal
          completedBillable={completedBillable}
          payableTotal={payableTotal}
          note={pullOutNote}
          onNoteChange={setPullOutNote}
          onClose={() => setShowWarn(false)}
          onConfirm={() => {
            setPullOutStatus("requested");
            setShowWarn(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Billing section — brought in from the old standalone Billing & Warranty page.
// Shows this job order's current bill and lets the customer settle it without
// leaving the tracking flow. Warranty browsing (for past services) stays on
// the Service History page; this section is scoped to the active job order.
// ---------------------------------------------------------------------------

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildInvoiceText(service: Service) {
  const total = serviceTotal(service);
  const lines = [
    "AutoKita — Service Invoice",
    "================================",
    `Invoice #: ${service.invoice}`,
    `Service: ${service.name}`,
    `Vehicle: ${service.vehicle}`,
    `Date: ${service.date}`,
    "",
  ];
  for (const cat of CATEGORY_ORDER) {
    const items = service.items.filter((i) => i.category === cat);
    if (!items.length) continue;
    lines.push(`-- ${cat} --`);
    for (const it of items) {
      lines.push(`${it.name}  x${it.qty}  @ ₱${peso(it.price)}  =  ₱${peso(it.qty * it.price)}`);
    }
    lines.push("");
  }
  lines.push(`Subtotal: ₱${peso(total)}`);
  if (service.status !== "pending") lines.push(`Amount Paid: ₱${peso(service.amountPaid)}`);
  if (service.status !== "paid") lines.push(`Balance Due: ₱${peso(total - service.amountPaid)}`);
  lines.push("", `Status: ${STATUS_STYLE[service.status].label}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Billing section — ported as-is from the old standalone Billing & Warranty
// page (same itemized Parts/Labor breakdown, payment chooser, invoice
// download), just relocated here and scoped to the vehicle in this job order
// instead of listing every service the customer has ever had.
// ---------------------------------------------------------------------------

function BillingSection({ jobOrder }: { jobOrder: JobOrder }) {
  const [services, setServices] = useState<Service[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getServices().then((data) => active && setServices(data));
    getWarranties().then((data) => active && setWarranties(data));
    return () => { active = false; };
  }, []);

  // Match this job order's service/warranties by plate number (falls back to
  // vehicle name match). Swap this for a direct job_order_id join once
  // billings.ts / billingController.ts exposes one.
  const matchesThisVehicle = (vehicle: string) =>
    vehicle.includes(jobOrder.plate_number) ||
    vehicle.includes(`${jobOrder.vehicle_year} ${jobOrder.vehicle_model}`);

  const service = services.find((s) => matchesThisVehicle(s.vehicle)) ?? services[0] ?? null;
  const vehicleWarranties = warranties.filter((w) => matchesThisVehicle(w.vehicle));

  if (!service) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Billing details for this service will appear here once available.</p>
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" /> Active Warranty
          </div>
          {vehicleWarranties.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No warranty on file for this vehicle yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {vehicleWarranties.map((w) => (
                <div key={w.t} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">🛡 {w.t}</div>
                    <div className="truncate text-[10px] text-muted-foreground">Expires: {w.expires}</div>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-[10px] font-semibold ${WARRANTY_STATUS_STYLE[w.status]}`}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const total = serviceTotal(service);
  const balance = total - service.amountPaid;
  const badge = STATUS_STYLE[service.status];

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-4 w-4 text-teal" /> Billing
          <span className={`ml-auto whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{service.invoice} · {service.vehicle}</p>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-xs text-muted-foreground">Total Due</span>
          <span className="text-lg font-bold text-teal">₱{peso(total)}</span>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2 text-xs font-semibold text-brand-foreground hover:opacity-90"
        >
          <CreditCard className="h-3.5 w-3.5" /> View Billing Details
        </button>

        {/* --- Active Warranty (moved in from the standalone Billing & Warranty page) --- */}
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-teal" /> Active Warranty
          </div>
          {vehicleWarranties.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No warranty on file for this vehicle yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {vehicleWarranties.map((w) => (
                <div key={w.t} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2.5 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">🛡 {w.t}</div>
                    <div className="truncate text-[10px] text-muted-foreground">Expires: {w.expires}</div>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap text-[10px] font-semibold ${WARRANTY_STATUS_STYLE[w.status]}`}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && (
        <ServiceModal
          service={service}
          onClose={() => setOpen(false)}
          onDownload={(s) => downloadText(`${s.invoice}.txt`, buildInvoiceText(s))}
          onSubmitPayment={(s, method) => {
            setServices((prev) =>
              prev.map((x) => (x.id === s.id ? { ...x, status: method === "ewallet" ? "verifying" : x.status } : x))
            );
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Service modal — sectioned Parts / Labor breakdown + payment (ported 1:1
// from the old Billing.tsx ServiceModal).
// ---------------------------------------------------------------------------

function ServiceModal({
  service,
  onClose,
  onDownload,
  onSubmitPayment,
}: {
  service: Service;
  onClose: () => void;
  onDownload: (s: Service) => void;
  onSubmitPayment: (s: Service, method: "shop" | "ewallet") => void;
}) {
  const [method, setMethod] = useState<"shop" | "ewallet">("ewallet");
  const total = serviceTotal(service);
  const balance = total - service.amountPaid;
  const badge = STATUS_STYLE[service.status];
  const needsPayment = service.status === "pending" || service.status === "downpayment";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b p-6">
          <div>
            <h2 className="text-lg font-bold">{service.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{service.invoice} · {service.date} · {service.vehicle}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-end">
            <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {CATEGORY_ORDER.map((cat) => {
            const items = service.items.filter((i) => i.category === cat);
            if (!items.length) return null;
            const sectionTotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
            return (
              <div key={cat} className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</h4>
                  <span className="text-xs text-muted-foreground">₱{peso(sectionTotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.name} className="border-b last:border-0">
                        <td className="py-2.5">{it.name}</td>
                        <td className="py-2.5 text-muted-foreground">x{it.qty}</td>
                        <td className="py-2.5 text-muted-foreground">₱{peso(it.price)}</td>
                        <td className="py-2.5 text-right font-medium">₱{peso(it.qty * it.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="ml-auto max-w-xs space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <b>₱{peso(total)}</b>
            </div>
            {service.status === "downpayment" && (
              <>
                <div className="flex justify-between text-success">
                  <span>Downpayment received:</span>
                  <span>− ₱{peso(service.amountPaid)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg">
                  <b>Balance Due:</b>
                  <b className="text-teal">₱{peso(balance)}</b>
                </div>
              </>
            )}
            {(service.status === "pending" || service.status === "verifying") && (
              <div className="flex justify-between border-t pt-2 text-lg">
                <b>Total Due:</b>
                <b className="text-teal">₱{peso(total)}</b>
              </div>
            )}
            {service.status === "paid" && (
              <div className="flex justify-between border-t pt-2 text-lg">
                <b>Total Paid:</b>
                <b className="text-success">₱{peso(service.amountPaid)}</b>
              </div>
            )}
          </div>

          {needsPayment && (
            <div className="mt-6 border-t pt-6">
              <h3 className="font-bold">Choose Payment Method</h3>
              <p className="text-xs text-muted-foreground">
                Select your preferred way to settle {service.status === "downpayment" ? "the remaining balance" : "this bill"}.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod("shop")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    method === "shop" ? "border-brand bg-brand-soft/30 shadow-sm" : "border-border hover:bg-muted/20"
                  }`}
                >
                  <Store className={`h-5 w-5 ${method === "shop" ? "text-brand" : "text-muted-foreground"}`} />
                  <span className="text-sm">Pay at Shop</span>
                </button>
                <button
                  onClick={() => setMethod("ewallet")}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                    method === "ewallet" ? "border-brand bg-brand-soft/30 shadow-sm" : "border-border hover:bg-muted/20"
                  }`}
                >
                  <Send className={`h-5 w-5 ${method === "ewallet" ? "text-brand" : "text-muted-foreground"}`} />
                  <span className="text-sm">E-Wallet Transfer</span>
                </button>
              </div>

              {method === "ewallet" && (
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Wallet className="h-3 w-3" /> Payment Details
                    </div>
                    {[
                      { n: "GCash", num: "0917-123-4567" },
                      { n: "Maya", num: "0908-765-4321" },
                    ].map((p) => (
                      <div key={p.n} className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 p-3">
                        <div className="text-xs">
                          <div className="text-sm font-bold">{p.n}</div>
                          <div>Account Name: <b>AutoCare Services</b></div>
                          <div>Mobile Number: <b>{p.num}</b></div>
                        </div>
                        <div className="text-center">
                          <div className="grid h-16 w-16 place-items-center rounded border bg-white p-1 text-[8px]">QR</div>
                          <div className="mt-1 text-[10px]">{p.n} QR</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Upload Payment Proof
                    </div>
                    <label className="mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center transition-colors hover:bg-muted/30">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">Drag and drop or click to upload PDF/JPG</p>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Estimated verification time for transfers: 2–4 business hours.
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t p-6">
          <button
            onClick={() => onDownload(service)}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm transition-colors hover:bg-muted/40"
          >
            <Download className="h-4 w-4" /> Download Invoice
          </button>
          {needsPayment ? (
            <button
              onClick={() => onSubmitPayment(service, method)}
              className="inline-flex items-center gap-2 rounded-md bg-[linear-gradient(90deg,#0b1730_0%,#1d3a68_55%,#3b6cb4_100%)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" />
              {service.status === "downpayment" ? `Pay Balance · ₱${peso(balance)}` : "Finish Checkout"}
            </button>
          ) : service.status === "verifying" ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-brand">
              <Clock className="h-4 w-4" /> Verifying payment…
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Fully Paid
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PullOutModal({
  completedBillable,
  payableTotal,
  note,
  onNoteChange,
  onClose,
  onConfirm,
}: {
  completedBillable: Task[];
  payableTotal: number;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");

  const submit = () => {
    setStatus("submitting");
    setTimeout(() => {
      setStatus("done");
      setTimeout(onConfirm, 800);
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-semibold">Pull-Out Request Sent</div>
            <p className="text-xs text-muted-foreground">
              The admin/ops manager has been notified.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-[color:oklch(0.55_0.2_10)]">
                <AlertCircle className="h-4 w-4" /> Pull Out Vehicle
              </div>
              <button onClick={onClose} className="rounded-full border p-1 hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Only the services that have already been completed will be billed. Any ongoing or
              pending work will be stopped and removed from your invoice.
            </p>

            <div className="mt-4 rounded-lg border bg-muted/20 p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Completed & Billable
              </div>
              {completedBillable.length > 0 ? (
                <div className="mt-2 space-y-2 text-sm">
                  {completedBillable.map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {t.task_title}
                      </span>
                      <span className="font-medium">
                        ₱{parseFloat(t.price || "0").toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  No billable services have been completed yet — pulling out now means no charge.
                </p>
              )}
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-semibold text-sm">Total Payable</span>
                <span className="text-lg font-bold">₱{payableTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="pullout-note" className="text-xs font-semibold">
                Reason for pulling out{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="pullout-note"
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="e.g. Need the car back for an emergency, will bring back later..."
                rows={3}
                className="mt-1.5 w-full resize-none rounded-md border bg-background p-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>

            <button
              onClick={submit}
              disabled={status === "submitting"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[color:oklch(0.6_0.22_350)] py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending Request…
                </>
              ) : (
                "Confirm Pull-Out Request"
              )}
            </button>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-md border py-2 text-sm hover:bg-accent"
            >
              Keep Servicing My Vehicle
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default InProgress;