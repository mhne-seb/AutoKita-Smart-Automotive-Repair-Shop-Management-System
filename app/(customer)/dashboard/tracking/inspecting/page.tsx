'use client'

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid, FileText, Wrench, ChevronRight, Loader2, Camera, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { Lightbox } from "@/components/Lightbox";
import { getInspectingData, respondToInspection } from "@/controllers/serviceProgressController";

function toneClass(status: string | null) {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("urgent") || s.includes("replace")) return "bg-destructive text-white";
  if (s.includes("attention") || s.includes("monitor")) return "bg-warning/20 text-[color:oklch(0.55_0.15_50)]";
  return "bg-success/15 text-[color:oklch(0.5_0.16_145)]";
}

function highlightToneClass(status: string | null) {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("urgent") || s.includes("replace")) return "bg-destructive text-white";
  if (s.includes("attention") || s.includes("monitor")) return "bg-warning text-white";
  return "bg-[color:oklch(0.6_0.15_240)] text-white";
}

function Inspecting() {
  useEffect(() => { document.title = "Inspecting — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<Awaited<ReturnType<typeof getInspectingData>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getInspectingData(userId, jobOrderId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const jobOrder = data?.jobOrder ?? null;
  const preDiagnostic = data?.preDiagnostic ?? null;
  const findings = data?.findings ?? [];
  const walkaround = data?.walkaround ?? [];
  const shop = data?.shop ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

  // No approval round yet means the mechanic is still working — what's in the
  // findings table right now is a draft, not a report the customer should act on.
  const awaitingReport = !preDiagnostic?.approval_status && !isHistorical;

  const [responding, setResponding] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const respond = async (decision: "approved" | "disputed") => {
    if (!jobOrder) return;
    setResponding(true);
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const res = await respondToInspection(userId, jobOrder.job_order_id, decision);
    if (res.success) {
      toast.success(
        decision === "approved"
          ? "Inspection approved. We're preparing your quotation."
          : "Thanks — we've flagged your concerns for the service team.",
      );
      setData(await getInspectingData(userId, jobOrder.job_order_id));
    } else {
      toast.error(res.message ?? "Could not submit your response.");
    }
    setResponding(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading inspection details…
        </div>
      </div>
    );
  }

  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You don't have any vehicle currently being inspected.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="inspecting" jobOrderId={jobOrder.job_order_id} />

      {preDiagnostic?.approval_status === "pending" && !isHistorical && (
        <div className="rounded-xl border-2 border-brand bg-brand-soft/40 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
            <div className="flex-1">
              <h3 className="font-bold">Please review your inspection report</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Our team has finished inspecting your vehicle. Review the findings below, then let
                us know if we can go ahead and prepare your quotation.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => respond("approved")}
                  disabled={responding}
                  className="flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> {responding ? "Sending…" : "Approve findings"}
                </button>
                <button
                  onClick={() => respond("disputed")}
                  disabled={responding}
                  className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  I have concerns
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {preDiagnostic?.approval_status === "approved" && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
          <Check className="h-4 w-4 flex-shrink-0 text-success" />
          You approved this inspection. We&apos;re preparing your quotation.
        </div>
      )}

      {preDiagnostic?.approval_status === "disputed" && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-warning" />
          You raised concerns about this inspection. Our service team will contact you shortly.
        </div>
      )}

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This job order has already been completed. You're viewing a read-only record.
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
        </div>
      )}

      <div className={!awaitingReport && findings.length > 0 ? "grid gap-6 lg:grid-cols-[2fr_1fr]" : "mx-auto max-w-3xl"}>
        <div className="space-y-6">
          {walkaround.length > 0 && (
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
                        <p className="mt-2 text-[11px] text-muted-foreground">{w.logged_date}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preDiagnostic?.mechanic_notes && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Inspection Summary</span>
                </div>
                <span className="rounded-full border px-3 py-0.5 text-[10px]">Official Record</span>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-white">
                  <Wrench className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <b>AutoKita Service Team</b>
                    <span className="text-xs text-success">Customer Visible</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{preDiagnostic.mechanic_notes}</p>
                  {preDiagnostic.datetime_created && (
                    <p className="mt-2 text-[11px] text-muted-foreground">{preDiagnostic.datetime_created}</p>
                  )}
                </div>
              </div>
              {(shop || jobOrder.estimated_duration) && (
                <div className="mt-5 grid grid-cols-2 gap-6 border-t pt-4 text-sm">
                  {shop && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Shop Location</div>
                      <div className="mt-1 font-semibold">{shop.name}</div>
                    </div>
                  )}
                  {jobOrder.estimated_duration && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Service Duration</div>
                      <div className="mt-1 font-semibold">{jobOrder.estimated_duration}</div>
                    </div>
                  )}
                </div>
              )}
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
                      <div className="mt-1 text-[10px] text-muted-foreground/70">{f.logged_date}</div>
                    </div>
                    {f.status && (
                      <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${toneClass(f.status)}`}>
                        {f.status}
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
        </div>

        {!awaitingReport && findings.length > 0 && (
          <aside className="space-y-5">
            <div className="rounded-xl border bg-card p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Report Highlights
              </div>
              <div className="mt-4 space-y-3 text-sm">
                {findings.map((f) => (
                  <div key={f.id} className="flex items-center justify-between">
                    <span>{f.name ?? "Finding"}</span>
                    {f.status && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${highlightToneClass(f.status)}`}>
                        {f.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
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