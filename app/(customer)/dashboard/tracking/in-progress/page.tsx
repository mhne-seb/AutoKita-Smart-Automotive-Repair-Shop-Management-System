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
  Store,
  Send,
  Camera,
  Upload,
  Receipt,
} from "lucide-react";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { getInProgressData } from "@/controllers/serviceProgressController";
import { Lightbox } from "@/components/Lightbox";
import { isRoadTest } from "@/data/roadTest";
import type { ServiceFinding } from "@/data/types";
import { FindingApprovalCard } from "@/components/dashboard/FindingApprovalCard";

// A part one of the services is waiting on. Only "still to order" vs "here"
// matters to the shop (no inventory system), so that's all we show.
type Part = {
  id: number;
  service_name: string;
  description: string;
  quantity: number;
  status: string;
};
const partIsReady = (p: Part) => p.status !== "to_order" && p.status !== "ordered" && p.status !== "in_transit";

type Task = {
  id: number;
  section_id: string;
  task_title: string;
  note: string;
  task_status: string;
  started_at?: string | null;
  completed_at: string | null;
  price: string;
  billable: boolean;
  scheduled_date?: string;
  estimated_finish?: string;
  // Photo the shop uploaded when they marked this finished — proof of work.
  completion_photo_url?: string | null;
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

// Same short format the admin pages use — the raw ISO string was leaking
// through to the customer ("2026-09-13T02:00:00.000Z").
function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function getTag(status: string): "completed" | "active" | "pending" {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "active";
  return "pending";
}

function InProgress() {
  useEffect(() => { document.title = "In Progress — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  type Timing = { started_at: string | null; completed_at: string | null; labor_hours_estimate: string | number | null; estimated_finish: string | null };
  const [data, setData] = useState<{ jobOrder: JobOrder | null; tasks: Task[]; parts?: Part[]; timing?: Timing | null; findings?: ServiceFinding[]; bill?: { total: number; paid: number; balance: number } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWarn, setShowWarn] = useState(false);
  const [pullOutStatus, setPullOutStatus] = useState<"none" | "requested">("none");
  const [photoView, setPhotoView] = useState<{ url: string; label: string } | null>(null);
  const [pullOutNote, setPullOutNote] = useState("");

  const load = () => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    return getInProgressData(userId, jobOrderId).then(setData);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrderIdParam]);

  const tasks = data?.tasks ?? [];
  const parts = data?.parts ?? [];
  // Mid-service findings waiting on this customer's yes/no.
  const pendingFindings = (data?.findings ?? []).filter((f) => f.decision === "pending");
  const userId = Number(typeof window !== "undefined" ? sessionStorage.getItem("autokita_user_id") : 0);
  // Parts still to be ordered, grouped by the service (task title) they belong to.
  const missingPartsFor = (taskTitle: string) => parts.filter((p) => p.service_name === taskTitle && !partIsReady(p));
  const partsFor = (taskTitle: string) => parts.filter((p) => p.service_name === taskTitle);
  const jobOrder = data?.jobOrder ?? null;

  // Locked once the job order has moved past active servicing — the
  // "Pull Out Vehicle" action no longer makes sense and must stay disabled.
  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

  // Auto-refresh while the shop is actively working — parts arriving, tasks
  // starting and finishing all happen on the admin side and should show up
  // here without a reload. Stops once the job is done.
  const shopIsWorking = Boolean(jobOrder) && !isHistorical;
  useEffect(() => {
    if (!shopIsWorking) return;
    const interval = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopIsWorking, jobOrderIdParam]);

  const completedBillable = tasks.filter(
    (t) => getTag(t.task_status) === "completed" && t.billable
  );
  const payableTotal = completedBillable.reduce(
    (sum, t) => sum + parseFloat(t.price || "0"),
    0
  );

  // Progress is over the services; the road test is the final check, not work.
  const serviceTasks = tasks.filter((t) => !isRoadTest(t));
  const completionPct = serviceTasks.length
    ? Math.round(
        (serviceTasks.filter((t) => getTag(t.task_status) === "completed").length / serviceTasks.length) * 100
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
        ...tasks.map((t) => {
          const missing = getTag(t.task_status) === "pending" ? missingPartsFor(t.task_title) : [];
          const all = partsFor(t.task_title);
          return {
            key: `task-${t.id}`,
            label: t.task_title,
            detail: isRoadTest(t)
              ? "Our mechanic drives your vehicle to make sure the repairs hold up on the road before we hand it back."
              : t.note && t.note !== "Describe the service..." ? t.note : undefined,
            photo: t.completion_photo_url ?? undefined,
            time: t.completed_at
              ? `Finished ${fmtWhen(t.completed_at)}`
              : missing.length > 0
              ? `Waiting for parts (${all.length - missing.length} of ${all.length} received)`
              : t.scheduled_date
              ? `Scheduled ${fmtWhen(t.scheduled_date)}`
              : null,
            status: getTag(t.task_status),
            waitingForParts: missing.length > 0,
          };
        }),
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
      <StageStepper active={stageForStatus(jobOrder.status)} viewing="in-progress" jobOrderId={jobOrder.job_order_id} />

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This service has already been completed. You're viewing a read-only record.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* Anything the mechanic found that needs a yes/no goes first — it's
              the one thing on this page that's waiting on the customer. */}
          {!isHistorical && pendingFindings.map((f) => (
            <FindingApprovalCard
              key={f.id}
              finding={f}
              userId={userId}
              onAnswered={load}
              onViewPhoto={(url) => setPhotoView({ url, label: "What the mechanic found" })}
            />
          ))}

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

                // Service tasks mirror what the shop tagged (Started / Finished);
                // one that hasn't started yet is simply "Upcoming". Other
                // milestones keep Completed/Pending.
                const isTask = entry.key.startsWith("task-");
                const waiting = Boolean((entry as { waitingForParts?: boolean }).waitingForParts);
                const badgeLabel = isOnHold
                  ? "On Hold"
                  : entry.status === "completed"
                  ? (isTask ? "Finished" : "Completed")
                  : entry.status === "active"
                  ? "Started"
                  : waiting
                  ? "Waiting for parts"
                  : (isTask ? "Upcoming" : "Pending");
                const badgeClasses = isOnHold
                  ? "bg-destructive/15 text-destructive"
                  : entry.status === "completed"
                  ? "bg-success/15 text-[color:oklch(0.5_0.16_145)]"
                  : entry.status === "active"
                  ? "bg-brand-soft text-brand"
                  : waiting
                  ? "bg-warning/15 text-[color:oklch(0.5_0.13_50)]"
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

                      {entry.key.startsWith("task-") && (entry as { photo?: string }).photo && (
                        <button
                          type="button"
                          onClick={() => setPhotoView({ url: (entry as { photo?: string }).photo!, label: `${entry.label} — finished work` })}
                          className="mt-2 flex items-center gap-2 rounded-lg border p-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent"
                        >
                          <img src={(entry as { photo?: string }).photo} alt={`${entry.label} finished`} className="h-12 w-16 shrink-0 rounded-md object-cover" />
                          <span><Camera className="mr-1 inline h-3 w-3" />Photo of the finished work — tap to enlarge</span>
                        </button>
                      )}
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
                              const dateA = a.started_at || a.scheduled_date || a.completed_at || '';
                              const dateB = b.started_at || b.scheduled_date || b.completed_at || '';
                              return new Date(dateA).getTime() - new Date(dateB).getTime();
                            })[0];
                          return firstTask?.started_at || firstTask?.scheduled_date || firstTask?.completed_at;
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
                  {/* Latest (scheduled start + quoted hours) across the tasks —
                      the same number the shop's own panel shows. */}
                  {fmtWhen(data?.timing?.estimated_finish) ?? 'Not scheduled'}
                </b>
              </div>
            </div>
            <div className="mt-4 border-t border-white/20 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Labor Hours (Est.)</span>
                <b>{Math.round(Number(data?.timing?.labor_hours_estimate ?? 0) * 10) / 10} hrs</b>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Time in Shop</span>
                <b>
                  {(() => {
                    // Wall clock since work started; frozen at completion.
                    const start = data?.timing?.started_at;
                    if (!start) return '—';
                    const end = data?.timing?.completed_at ? new Date(data.timing.completed_at).getTime() : Date.now();
                    return `${Math.max(0, Math.round(((end - new Date(start).getTime()) / 36e5) * 10) / 10)} hrs`;
                  })()}
                </b>
              </div>
            </div>
          </div>

          {/* Running bill — what the job costs so far and what's still owed.
              Read-only here; payment happens once the job is Completed. */}
          {data?.bill && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-teal" /> Bill So Far
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Services &amp; parts</span><span>₱{data.bill.total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Paid</span><span>− ₱{data.bill.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                <div className="flex items-center justify-between border-t pt-2 font-semibold"><span>Balance to pay</span><span className="text-lg text-teal">₱{data.bill.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Updates as work is added. You'll settle this once the service is completed.</p>
            </div>
          )}

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

      {photoView && <Lightbox url={photoView.url} label={photoView.label} onClose={() => setPhotoView(null)} />}

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
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-[color:oklch(0.6_0.22_350)] py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[color:oklch(0.54_0.22_350)] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none disabled:active:scale-100"
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
              className="mt-2 w-full rounded-md border py-2 text-sm transition-all duration-150 hover:border-foreground/30 hover:bg-accent active:scale-[0.98]"
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