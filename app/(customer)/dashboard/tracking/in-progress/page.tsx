'use client'

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, AlertCircle, Info, X, Wrench, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getInProgressData } from "@/controllers/serviceProgressController";

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
  const [expanded, setExpanded] = useState<string | null>(null);

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
                {tasks.length} Tasks Total
              </span>
            </div>

            <div className="mt-4">
              {tasks.map((t, idx) => {
                const tag = getTag(t.task_status);
                const isOpen = expanded === String(t.id);
                const isCollapsible = tag === "completed";
                const isLast = idx === tasks.length - 1;
                const isOnHold = pullOutStatus === "requested" && tag !== "completed";

                const badgeLabel = isOnHold
                  ? "On Hold"
                  : tag === "completed"
                  ? "Completed"
                  : tag === "active"
                  ? "Active"
                  : "Pending";
                const badgeClasses = isOnHold
                  ? "bg-destructive/15 text-destructive"
                  : tag === "completed"
                  ? "bg-success/15 text-[color:oklch(0.5_0.16_145)]"
                  : tag === "active"
                  ? "bg-brand-soft text-brand"
                  : "bg-muted text-muted-foreground";

                return (
                  <div key={t.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          tag === "completed"
                            ? "border-muted-foreground/40 bg-background"
                            : isOnHold
                            ? "border-destructive bg-background"
                            : tag === "active"
                            ? "border-brand bg-background"
                            : "border-muted-foreground/20 bg-background"
                        }`}
                      >
                        {tag === "active" && !isOnHold && (
                          <>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
                            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                          </>
                        )}
                        {isOnHold && <X className="h-3.5 w-3.5 text-destructive" strokeWidth={2.5} />}
                        {tag === "completed" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
                        )}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border" />}
                    </div>

                    <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"} ${isOnHold ? "opacity-70" : ""}`}>
                      <button
                        type="button"
                        onClick={() => isCollapsible && setExpanded(isOpen ? null : String(t.id))}
                        className={`flex w-full items-start justify-between text-left ${
                          isCollapsible ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{t.task_title}</div>
                          {t.note && t.note !== 'Describe the service...' && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.note}</p>
                          )}
                          {t.completed_at && !isOpen && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {t.completed_at}
                            </div>
                          )}
                          {t.estimated_finish && tag !== 'completed' && !isOpen && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                              <Clock className="h-3 w-3" />
                              Est. Finish: {new Date(t.estimated_finish).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}
                          >
                            {badgeLabel}
                          </span>
                          {isCollapsible && (
                            <ChevronDown
                              className={`h-4 w-4 text-muted-foreground transition-transform ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          )}
                        </div>
                      </button>

                      {isCollapsible && isOpen && (
                        <div className="mt-2 rounded-lg border bg-muted/20 p-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                            <span>{t.completed_at}</span>
                            <span className="text-success">Verified</span>
                          </div>
                          {t.note && t.note !== 'Describe the service...' && (
                            <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)] text-xs font-bold uppercase tracking-wider">
                📋 Technician's Log
              </div>
              <span className="rounded-full border px-2.5 py-0.5 text-[10px]">Verified Record</span>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-white">
                <Wrench className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <b>AutoKita Service Team</b>
                  </div>
                  <span className="text-xs text-success">Customer Visible</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Latest updates for {jobOrder.vehicle_year} {jobOrder.vehicle_model} will appear here
                  as your technician logs progress.
                </p>
              </div>
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