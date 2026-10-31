'use client'

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FileText, ChevronRight, Loader2, Camera, AlertCircle, Check, ScanLine, Store, Home } from "lucide-react";
import { toast } from "sonner";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { Lightbox } from "@/components/Lightbox";
import { getInspectingData, respondToInspection, cancelJobOrder, type CustomerDiagnosticReport, type CustomerDiagnosticTroubleCode } from "@/controllers/serviceProgressController";
import { ShopLoading } from "@/components/ShopLoading";
import { formatStamp, parseStamp } from "@/lib/utils";
import { ScanAuthorizationCard } from "@/components/dashboard/ScanAuthorizationCard";
import { serviceModeFromDb } from "@/lib/serviceMode";

function toneClass(status: string | null) {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("urgent") || s.includes("replace")) return "bg-destructive text-white";
  if (s.includes("attention") || s.includes("monitor")) return "bg-warning/20 text-[color:oklch(0.55_0.15_50)]";
  return "bg-success/15 text-[color:oklch(0.5_0.16_145)]";
}

// The database stores 'ok' / 'needs_attention' / 'urgent'; customers see plain labels.
function findingLabel(status: string | null) {
  const s = (status ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (s === "ok") return "Good Condition";
  if (s === "needs_attention") return "Needs Attention";
  if (s === "urgent" || s.includes("replace")) return "Replacement Required";
  return status ?? "";
}

function DiagnosticReportCard({
  report,
  dtcs,
}: {
  report: CustomerDiagnosticReport
  dtcs: CustomerDiagnosticTroubleCode[]
}) {
  const reportDate = parseStamp(report.report_date);
  const linkedAt = parseStamp(report.linked_at);

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
          <ScanLine size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">OBD-II Diagnostic Report</h3>
          <p className="text-xs text-muted-foreground">
            Scanner findings from LAUNCH X-431 or compatible tools
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
        <ScanLine size={16} className="flex-shrink-0" />
        <span>
          <b>Diagnostic scan completed.</b> These are the results recorded from your vehicle.
        </span>
      </div>

      {/* Report details grid */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-muted/30 p-4 text-xs sm:grid-cols-2 md:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Scanner</p>
          <p className="font-semibold text-foreground">{report.scanner_tool ?? '—'}</p>
          {report.scanner_software && (
            <p className="text-muted-foreground">{report.scanner_software}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground">Report Date</p>
          <p className="font-semibold text-foreground">
            {reportDate
              ? reportDate.toLocaleString('en-PH', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Vehicle (Scanner)</p>
          <p className="font-semibold text-foreground">
            {[report.reported_make, report.reported_model, report.reported_year]
              .filter(Boolean)
              .join(' ') || '—'}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            {report.reported_plate && (
              <span className="text-[10px] font-semibold text-foreground/80">
                {report.reported_plate}
              </span>
            )}
            {report.reported_vin ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                VIN: {report.reported_vin}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-amber-600">No VIN</span>
            )}
          </div>
        </div>
        {report.test_mileage != null && (
          <div>
            <p className="text-muted-foreground">Mileage at Scan</p>
            <p className="font-semibold text-foreground">{report.test_mileage.toLocaleString()} km</p>
          </div>
        )}
        {linkedAt && (
          <div>
            <p className="text-muted-foreground">Scan Linked</p>
            <p className="font-semibold text-foreground">
              {linkedAt.toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        )}
      </div>

      {/* DTC codes table */}
      {dtcs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Diagnostic Trouble Codes (DTCs) were extracted from this report.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Diagnostic Trouble Codes ({dtcs.length})
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[500px] text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Code</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Description</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">State</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground">System</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dtcs.map((dtc, index) => {
                  const stateLower = (dtc.dtc_state ?? '').toLowerCase()
                  const stateClass =
                    stateLower === 'current'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      : stateLower === 'pending'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground'
                  return (
                    <tr key={index} className="bg-card hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-mono font-bold text-foreground">{dtc.dtc_code}</span>
                      </td>
                      <td className="px-3 py-2 text-foreground">{dtc.dtc_description ?? '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${stateClass}`}>
                          {dtc.dtc_state ?? '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {dtc.dtc_system ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Your mechanic will explain any recommended repair before work begins.
          </p>
        </div>
      )}
    </div>
  )
}

function Inspecting() {
  useEffect(() => { document.title = "Inspecting — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<Awaited<ReturnType<typeof getInspectingData>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getInspectingData(userId, jobOrderId)
      .then((res) => {
        if (res?._status === 401 || res?._status === 403) {
          sessionStorage.removeItem("autokita_customer");
          sessionStorage.removeItem("autokita_user_id");
          sessionStorage.removeItem("autokita_user_name");
          router.replace('/login');
          return;
        }
        setData(res);
      })
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const jobOrder = data?.jobOrder ?? null;
  const preDiagnostic = data?.preDiagnostic ?? null;
  const findings = data?.findings ?? [];
  const reviewHistory = data?.reviewHistory ?? [];
  const walkaround = data?.walkaround ?? [];
  const diagnosticReport = data?.diagnosticReport ?? null;
  const diagnosticTroubleCodes = data?.diagnosticTroubleCodes ?? [];
  const scanAuthorization = data?.scanAuthorization ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

  const stillInspecting = jobOrder?.status === "inspecting";
  const inspectionStatus: string | undefined = stillInspecting ? preDiagnostic?.approval_status ?? undefined : "approved";
  const movedOn = !stillInspecting && !isHistorical && Boolean(jobOrder);

  // No approval round yet means the mechanic is still working — what's in the
  // findings table right now is a draft, not a report the customer should act on.
  const awaitingReport = !inspectionStatus && !isHistorical;

  // Auto-refresh while waiting on the shop: no report yet, or a disputed one
  // that's being revised. Nothing to poll for once it's the customer's own
  // turn to act (pending) or the inspection is already settled.
  const waitingOnShop = awaitingReport || inspectionStatus === "disputed";
  useEffect(() => {
    if (!waitingOnShop) return;
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    const interval = setInterval(() => {
      getInspectingData(userId, jobOrderId).then((res: any) => {
        if (res?._status === 401 || res?._status === 403) {
          sessionStorage.removeItem("autokita_customer");
          sessionStorage.removeItem("autokita_user_id");
          sessionStorage.removeItem("autokita_user_name");
          router.replace('/login');
          return;
        }
        setData(res);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [waitingOnShop, jobOrderIdParam]);

  const [responding, setResponding] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  // "I have concerns" opens a one-line box before anything is sent — the line
  // is the record; the actual conversation happens by phone.
  const [concernOpen, setConcernOpen] = useState(false);
  const [concern, setConcern] = useState("");
  // Two-step cancel, same pattern as the dashboard's pending-booking cancel.
  const [cancelArmed, setCancelArmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const canCancel = data?.canCancel ?? false;

  const cancel = async () => {
    if (!jobOrder) return;
    setCancelling(true);
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const res = await cancelJobOrder(userId, jobOrder.job_order_id);
    if (res.success) {
      toast.success("Booking cancelled.");
      router.push("/dashboard");
    } else {
      toast.error(res.message ?? "Could not cancel this booking.");
      setCancelling(false);
      setCancelArmed(false);
    }
  };

  const respond = async (decision: "approved" | "disputed") => {
    if (!jobOrder) return;
    setResponding(true);
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const res = await respondToInspection(userId, jobOrder.job_order_id, decision, concern);
    if (res.success) {
      toast.success(
        decision === "approved"
          ? "Inspection approved. We're preparing your quotation."
          : "Thanks — we've noted your concern and will call you to sort it out.",
      );
      setConcernOpen(false);
      setConcern("");
      setData(await getInspectingData(userId, jobOrder.job_order_id));
    } else {
      toast.error(res.message ?? "Could not submit your response.");
    }
    setResponding(false);
  };

  if (loading) {
    return (
      <ShopLoading message="Loading your inspection" />
    );
  }

  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You don&apos;t have any vehicle currently being inspected.
        </div>
      </div>
    );
  }

  if (!jobOrder.date_arrived) {
    const isHome = serviceModeFromDb(jobOrder.service_mode) === 'home';
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <StageStepper
          active={stageForStatus(jobOrder.status, jobOrder.date_arrived)}
          viewing="inspecting"
          jobOrderId={jobOrder.job_order_id}
          serviceMode={serviceModeFromDb(jobOrder.service_mode)}
        />
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-sm mb-4">
            {isHome ? <Home className="h-6 w-6" /> : <Store className="h-6 w-6" />}
          </div>
          <h2 className="text-2xl font-bold text-amber-950">
            {isHome ? "Awaiting Mechanic Arrival" : "Awaiting Vehicle Drop-off"}
          </h2>
          <p className="mt-2 text-sm text-amber-900/80 max-w-lg mx-auto">
            {isHome
              ? "Your booking has been approved. The inspection starts once our mechanic arrives at your address and our shop staff marks the visit as started."
              : "Your booking has been approved, but your vehicle has not been stored in the shop yet. The inspection stage will begin once your vehicle is dropped off and marked as checked in by our shop staff."}
          </p>
          <div className="mt-6">
            <Link
              href={`/dashboard/tracking/received?jobOrderId=${jobOrder.job_order_id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all"
            >
              {isHome ? <Home className="h-4 w-4" /> : <Store className="h-4 w-4" />}
              {isHome ? "View Arrival Details" : "View Drop-off & Check-In Details"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper
        active={stageForStatus(jobOrder.status, jobOrder.date_arrived)}
        viewing="inspecting"
        jobOrderId={jobOrder.job_order_id}
        serviceMode={serviceModeFromDb(jobOrder.service_mode)}
      />

      {scanAuthorization?.decision === "pending" && !isHistorical && (
        <ScanAuthorizationCard
          authorizationId={scanAuthorization.id}
          userId={Number(sessionStorage.getItem("autokita_user_id"))}
          onAnswered={async () => {
            const userId = Number(sessionStorage.getItem("autokita_user_id"));
            const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
            const fresh = await getInspectingData(userId, jobOrderId);
            setData(fresh);
          }}
        />
      )}

      {inspectionStatus === "pending" && !isHistorical && (
        <div className="rounded-xl border-2 border-brand bg-brand-soft/40 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
            <div className="flex-1">
              <h3 className="font-bold">Please review your inspection report</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Our team has finished inspecting your vehicle. Review the findings below, then let
                us know if we can go ahead and prepare your quotation.
              </p>
              {!concernOpen ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => respond("approved")}
                    disabled={responding}
                    className="flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> {responding ? "Sending…" : "Approve findings"}
                  </button>
                  <button
                    onClick={() => setConcernOpen(true)}
                    disabled={responding}
                    className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                  >
                    I have concerns
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <label htmlFor="concern" className="text-sm font-medium">
                    Briefly, what&apos;s your concern?
                  </label>
                  <input
                    id="concern"
                    value={concern}
                    onChange={(e) => setConcern(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && concern.trim()) respond("disputed"); }}
                    maxLength={200}
                    autoFocus
                    placeholder="e.g. The brake pads were replaced last month"
                    className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    We&apos;ll call you to talk it through, then send a revised report for you to approve here.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => respond("disputed")}
                      disabled={responding || !concern.trim()}
                      className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {responding ? "Sending…" : "Send concern"}
                    </button>
                    <button
                      onClick={() => { setConcernOpen(false); setConcern(""); }}
                      disabled={responding}
                      className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {inspectionStatus === "approved" && !isHistorical && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0 text-success" />
            {movedOn ? "You approved this inspection." : "You approved this inspection. We’re preparing your quotation."}
          </span>
          {movedOn && (
            <Link
              href={`/dashboard/tracking/quotation?jobOrderId=${jobOrder!.job_order_id}`}
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              View quotation <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}

      {inspectionStatus === "disputed" && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-warning" />
          You raised concerns about this inspection. Our service team will contact you shortly.
        </div>
      )}

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This job order has already been completed. You&apos;re viewing a read-only record.
        </div>
      )}

      {awaitingReport && (
        <div className="mx-auto max-w-4xl rounded-2xl border bg-card px-8 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
          <h3 className="mt-4 font-bold">Inspection in progress</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Our team is still inspecting your vehicle. Once the mechanic finalizes the report,
            the findings will appear here and we&apos;ll ask you to review them before any
            quotation is prepared.
          </p>

          {/* Only offered while nothing has been done to the car yet — the API
              decides that, this just shows what it said. */}
          {canCancel && (
            <div className="mt-6 border-t pt-5">
              {!cancelArmed ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Changed your mind? You can still cancel — it&apos;s free until the mechanic begins
                    work on your vehicle.
                  </p>
                  <button
                    onClick={() => setCancelArmed(true)}
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-destructive/40 px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Cancel this booking
                  </button>
                </>
              ) : (
                <div className="mx-auto max-w-sm">
                  <p className="text-sm font-medium">Cancel this booking?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your slot will be released and you&apos;ll need to book again if you change your mind.
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      onClick={cancel}
                      disabled={cancelling}
                      className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {cancelling ? "Cancelling…" : "Yes, cancel booking"}
                    </button>
                    <button
                      onClick={() => setCancelArmed(false)}
                      disabled={cancelling}
                      className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={!awaitingReport && reviewHistory.length > 0 ? "grid gap-6 lg:grid-cols-[2fr_1fr]" : "mx-auto max-w-3xl"}>
        <div className="space-y-6">
          {/* Same gate as the findings: the photos are part of the report the
              mechanic sends, so they stay hidden until "Upload to customer
              portal" — otherwise half-written notes show up live. */}
          {!awaitingReport && walkaround.length > 0 && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]">
                  <Camera className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pre-Diagnostics</span>
                </div>
                <span className="rounded-full border px-3 py-0.5 text-[10px]">Official Record</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Your vehicle&apos;s condition as documented on arrival, before any work began.
              </p>
              <div className="mt-4 divide-y">
                {walkaround.map((w) => (
                  <div key={w.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[160px_1fr]">
                    <button
                      type="button"
                      onClick={() => setLightbox({ url: w.photo, label: w.label })}
                      className="group relative overflow-hidden rounded-lg"
                      title="Click to enlarge"
                    >
                      <img src={w.photo} alt={w.label} className="aspect-[4/3] w-full object-cover" />
                      <span className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                    <div>
                      <div className="font-semibold">{w.label}</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {w.note?.trim() ? w.note : <span className="italic">No condition notes recorded for this area.</span>}
                      </p>
                      {w.logged_date && (
                        <p className="mt-2 text-[11px] text-muted-foreground">{formatStamp(w.logged_date)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!awaitingReport && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Mechanical Findings</span>
              </div>
              <div className="mt-4 divide-y">
                {findings.map((f) => (
                  <div key={f.id} className="flex items-start justify-between gap-4 py-4">
                    <div>
                      {f.name && <div className="font-semibold">{f.name}</div>}
                      <p className="mt-1 text-xs text-muted-foreground">{f.findings_description}</p>
                      <div className="mt-1 text-[10px] text-muted-foreground/70">{formatStamp(f.logged_date)}</div>
                    </div>
                    {f.status && (
                      <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${toneClass(f.status)}`}>
                        {findingLabel(f.status)}
                      </span>
                    )}
                  </div>
                ))}
                {findings.length === 0 && (
                  <p className="py-4 text-sm text-muted-foreground">No findings recorded yet.</p>
                )}
              </div>
            </div>
          )}

          {!awaitingReport && diagnosticReport && (
            <DiagnosticReportCard report={diagnosticReport} dtcs={diagnosticTroubleCodes} />
          )}
        </div>

        {!awaitingReport && reviewHistory.length > 0 && (
          <aside className="space-y-5">
            <div className="rounded-xl border bg-card p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Review History
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Every report we&apos;ve sent you, and how you answered.
              </p>
              <ol className="mt-4 space-y-4 border-l pl-4 text-sm">
                {reviewHistory.map((round, i) => (
                  <li key={round.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-brand" />
                    <div className="font-semibold">
                      Report {reviewHistory.length > 1 ? `#${i + 1} ` : ""}sent
                    </div>
                    <div className="text-[11px] text-muted-foreground">{formatStamp(round.sent_at)}</div>
                    {round.mechanic_notes && (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{round.mechanic_notes}</p>
                    )}

                    {round.status === "approved" && (
                      <div className="mt-2 rounded-md bg-success/10 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                          <Check className="h-3.5 w-3.5" /> You approved
                        </div>
                        {round.responded_at && (
                          <div className="text-[11px] text-muted-foreground">{formatStamp(round.responded_at)}</div>
                        )}
                      </div>
                    )}
                    {round.status === "disputed" && (
                      <div className="mt-2 rounded-md bg-warning/10 px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                          <AlertCircle className="h-3.5 w-3.5" /> You raised a concern
                        </div>
                        {round.customer_reason && (
                          <p className="mt-1 text-xs italic">&ldquo;{round.customer_reason}&rdquo;</p>
                        )}
                        {round.responded_at && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{formatStamp(round.responded_at)}</div>
                        )}
                      </div>
                    )}
                    {round.status === "pending" && (
                      <div className="mt-2 text-xs font-medium text-brand">Awaiting your review</div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        )}
      </div>

      {
        lightbox && (
          <Lightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
        )
      }
    </div >
  );
}

export default Inspecting;