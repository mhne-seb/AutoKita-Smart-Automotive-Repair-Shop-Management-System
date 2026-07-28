'use client'

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { LayoutGrid, FileText, Wrench, ChevronRight, Loader2, Camera, AlertCircle } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getInspectingData } from "@/controllers/serviceProgressController";

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
  const shop = data?.shop ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

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

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This job order has already been completed. You're viewing a read-only record.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {preDiagnostic?.mechanic_notes && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pre-Diagnostics</span>
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

          {findings.some((f) => f.photo) && (
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]">
                <Camera className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Photo Documentation</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                {findings.filter((f) => f.photo).map((f) => (
                  <div key={f.id} className="text-center">
                    <img src={f.photo!} alt={f.name ?? "Inspection photo"} className="aspect-video w-full rounded-lg object-cover" />
                    <div className="mt-2 text-xs">{f.name ?? "Inspection photo"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border-2 border-brand bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isHistorical ? "Historical Record" : "Next Step"}
            </div>
            <h3 className="mt-1 text-lg font-bold">
              {isHistorical ? "Quotation Was Prepared" : "Quotation is Being Prepared"}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {isHistorical
                ? "Here's the quotation that was prepared for this job order."
                : "Based on these findings, we're putting together your service quotation. You'll be able to review and approve it before any work begins."}
            </p>
            <Link
              href={`/dashboard/tracking/quotation?jobOrderId=${jobOrder.job_order_id}`}
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              View Quotation <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {findings.length > 0 && (
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
          )}
        </aside>
      </div>
    </div>
  );
}

export default Inspecting;