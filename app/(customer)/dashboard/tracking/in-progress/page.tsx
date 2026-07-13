'use client'


import { useState, useEffect} from "react";
import { Clock, AlertCircle, Info, X, Wrench, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";

// static asset path
const c1 = "/assets/diagnostic/c1.jpg"; 
const c2 = "/assets/diagnostic/c2.jpg"; 
const c3 = "/assets/diagnostic/c3.jpg"; 
const c4 = "/assets/diagnostic/c4.jpg"; 
const c5 = "/assets/diagnostic/c5.jpg"; 
const c6 = "/assets/diagnostic/c6.jpg"; 

const DIAGNOSTIC_IMAGES = [c1, c2, c3, c4, c5, c6];

// Deterministic "random" pick per task so it doesn't reshuffle on re-render
function pickImages(seed: number, count: number) {
  const pool = [...DIAGNOSTIC_IMAGES];
  const picked: string[] = [];
  let i = seed;
  for (let n = 0; n < count; n++) {
    i = (i + 7) % pool.length;
    picked.push(pool[i]);
  }
  return picked;
}

type TimelineItem = {
  key: string;
  t: string;
  tag: "completed" | "active" | "pending";
  tone: "success" | "brand" | "muted";
  note: string;
  time?: string;
  price: number;
  billable: boolean;
  // Extra detail shown once a task is completed
  technician?: string;
  detail?: string;
  imageSeed?: number;
};

const TIMELINE: TimelineItem[] = [
  {
    key: "battery",
    t: "Battery Check",
    tag: "completed",
    tone: "success",
    note: "Voltage holding steady at 12.6V. No leakage.",
    time: "08:45 AM",
    price: 0,
    billable: false,
    technician: "Mark D.",
    detail: "Load test passed. Terminals cleaned and re-torqued. No corrosion found on either post.",
    imageSeed: 1,
  },
  {
    key: "tires",
    t: "Tire Tread Inspection",
    tag: "completed",
    tone: "success",
    note: "Depth consistent at 6mm across all tires.",
    time: "09:15 AM",
    price: 0,
    billable: false,
    technician: "Mark D.",
    detail: "All four tires measured within safe range. Pressure adjusted to manufacturer spec (32 psi).",
    imageSeed: 2,
  },
  {
    key: "oil",
    t: "Engine Oil & Filter Change",
    tag: "completed",
    tone: "success",
    note: "Full synthetic oil replaced, new filter installed.",
    time: "09:50 AM",
    price: 3200,
    billable: true,
    technician: "Mark D.",
    detail: "Drained old oil, replaced with full synthetic 5W-30. OEM filter installed. No leaks after refill.",
    imageSeed: 3,
  },
  {
    key: "brakes",
    t: "Front Brake Pad Replacement",
    tag: "active",
    tone: "brand",
    note: "Replace/Urgent: Pad thickness at 2mm.",
    time: "Started 10:05 AM",
    price: 7050,
    billable: true,
    technician: "Mark D.",
  },
  {
    key: "airfilter",
    t: "Air Filter Replacement",
    tag: "pending",
    tone: "muted",
    note: "Needs attention: Dust accumulation visible.",
    price: 1800,
    billable: true,
  },
  {
    key: "trans",
    t: "Transmission Fluid Flush",
    tag: "pending",
    tone: "muted",
    note: "Replace/Urgent: Fluid is discolored.",
    price: 4500,
    billable: true,
  },
];

function InProgress() {
  useEffect(() => { document.title = "In Progress — AutoKita"; }, []);

  const [showWarn, setShowWarn] = useState(false);
  const [pullOutStatus, setPullOutStatus] = useState<"none" | "requested">("none");
  const [pullOutNote, setPullOutNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const completedBillable = TIMELINE.filter((s) => s.tag === "completed" && s.billable);
  const payableTotal = completedBillable.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="in-progress" />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* LEFT: enlarged Service Timeline */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between border-l-4 border-brand pl-3">
              <h2 className="text-xl font-bold">Service Timeline</h2>
              <span className="rounded-md border px-2.5 py-1 text-xs font-semibold">
                {TIMELINE.length} Tasks Total
              </span>
            </div>

            <div className="mt-4">
              {TIMELINE.map((s, idx) => {
                const isOpen = expanded === s.key;
                const isCollapsible = s.tag === "completed";
                const isLast = idx === TIMELINE.length - 1;
                const images = s.imageSeed ? pickImages(s.imageSeed, 3) : [];
                const isOnHold = pullOutStatus === "requested" && s.tag !== "completed";

                const badgeLabel = isOnHold
                  ? "On Hold"
                  : s.tag === "completed"
                  ? "Completed"
                  : s.tag === "active"
                  ? "Active"
                  : "Pending";
                const badgeClasses = isOnHold
                  ? "bg-destructive/15 text-destructive"
                  : s.tag === "completed"
                  ? "bg-success/15 text-[color:oklch(0.5_0.16_145)]"
                  : s.tag === "active"
                  ? "bg-brand-soft text-brand"
                  : "bg-muted text-muted-foreground";

                return (
                  <div key={s.key} className="flex gap-3">
                    {/* Rail: icon + connecting line */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          s.tag === "completed"
                            ? "border-muted-foreground/40 bg-background"
                            : isOnHold
                            ? "border-destructive bg-background"
                            : s.tag === "active"
                            ? "border-brand bg-background"
                            : "border-muted-foreground/20 bg-background"
                        }`}
                      >
                        {s.tag === "active" && !isOnHold && (
                          <>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
                            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                          </>
                        )}
                        {isOnHold && <X className="h-3.5 w-3.5 text-destructive" strokeWidth={2.5} />}
                        {s.tag === "completed" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
                        )}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border" />}
                    </div>

                    <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"} ${isOnHold ? "opacity-70" : ""}`}>
                      <button
                        type="button"
                        onClick={() => isCollapsible && setExpanded(isOpen ? null : s.key)}
                        className={`flex w-full items-start justify-between text-left ${
                          isCollapsible ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{s.t}</div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.note}</p>
                          {s.time && !isOpen && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {s.time}
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

                      {/* Expanded detail + images, only for completed tasks */}
                      {isCollapsible && isOpen && (
                        <div className="mt-2 rounded-lg border bg-muted/20 p-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                            <span>{s.time}</span>
                            <span className="text-success">Verified</span>
                          </div>
                          {s.detail && <p className="mt-2 text-xs text-muted-foreground">{s.detail}</p>}
                          {images.length > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2">
                              {images.map((img, i) => (
                                <img
                                  key={i}
                                  src={img}
                                  alt={`${s.t} photo ${i + 1}`}
                                  className="aspect-square w-full rounded-md object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Technician's Log kept below the timeline */}
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
                    <b>AutoKita Service Team</b>{" "}
                    <span className="text-xs text-muted-foreground">• 15 mins ago</span>
                  </div>
                  <span className="text-xs text-success">Customer Visible</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Initial scan completed for the 2022 Tesla Model 3. The brake system requires
                  immediate attention as noted in the findings below. We've also topped up the
                  washer fluid as a courtesy. Battery health remains optimal. We recommend
                  immediate replacement of front brake pads to ensure safety.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <aside className="space-y-4">
          <div className="rounded-xl bg-brand p-5 text-brand-foreground">
            <div className="text-3xl font-bold">88%</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              Overall Completion
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/20">
              <div className="h-full w-[88%] rounded-full bg-white" />
            </div>
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Started
                </span>
                <b>08:15 AM Today</b>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Estimated Finish
                </span>
                <b>04:30 PM Today</b>
              </div>
            </div>
            <div className="mt-4 border-t border-white/20 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span>Labor Hours (Est.)</span>
                <b>6.5 Hours</b>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Current Duration</span>
                <b>4.2 Hours</b>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wrench className="h-4 w-4 text-teal" /> Assigned Team
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Your vehicle is being serviced by a certified AutoKita technician specializing in
              EV maintenance and brake systems.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Vehicle Actions
            </div>

            {pullOutStatus === "requested" ? (
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

            <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 font-semibold">
                <Info className="h-3 w-3" /> Note
              </div>
              <p className="mt-1">
                Use this to request pulling your vehicle out of service. Only completed work will
                be charged; ongoing and pending services will be cancelled.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {showWarn && (
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
  completedBillable: TimelineItem[];
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
                  {completedBillable.map((s) => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {s.t}
                      </span>
                      <span className="font-medium">₱{s.price.toLocaleString()}</span>
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
