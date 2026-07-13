'use client'

// Route: /dashboard/tracking/inspecting — read-only tracking view for a vehicle currently under inspection.
import { useEffect } from "react";

import Link from "next/link";
import { LayoutGrid, Camera, FileText, Car, Wrench, ChevronRight } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";

const FINDINGS = [
  { t: "Engine oil", d: "Oil levels are slightly low; recommended synthetic upgrade for high mileage.", tag: "Needs attention", tone: "warning" },
  { t: "Front brake pads", d: "Pad thickness at 2mm. Critical safety risk. Immediate replacement required.", tag: "Replace/Urgent", tone: "destructive" },
  { t: "Battery", d: "Voltage holding steady at 12.6V. No leakage or corrosion detected.", tag: "OK", tone: "success" },
  { t: "Air filter", d: "Dust accumulation visible. Should be replaced in the next service interval.", tag: "Needs attention", tone: "warning" },
  { t: "Transmission fluid", d: "Fluid is discolored with a slight burnt odor. Recommend a full flush.", tag: "Replace/Urgent", tone: "destructive" },
  { t: "Tire tread depth", d: "Depth consistent at 6mm across all tires. Even wear pattern.", tag: "OK", tone: "success" },
];

function toneClass(t: string) {
  return t === "destructive" ? "bg-destructive text-white" : t === "warning" ? "bg-warning/20 text-warning-foreground text-[color:oklch(0.55_0.15_50)]" : "bg-success/15 text-[color:oklch(0.5_0.16_145)]";
}

function Inspecting() {
  useEffect(() => { document.title = "Inspecting — AutoKita"; }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="inspecting" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]"><LayoutGrid className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Pre-Diagnostics</span></div>
              <span className="rounded-full border px-3 py-0.5 text-[10px]">Official Record</span>
            </div>
            <div className="mt-4 flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal text-white"><Wrench className="h-3.5 w-3.5" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div><b>AutoKita Service Team</b> <span className="text-xs text-muted-foreground">• 15 mins ago</span></div>
                  <span className="text-xs text-success">Customer Visible</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Initial scan completed for the 2022 Tesla Model 3. The brake system requires immediate attention as noted in the findings below. We've also topped up the washer fluid as a courtesy. Battery health remains optimal. We recommend immediate replacement of front brake pads to ensure safety.</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-6 border-t pt-4 text-sm">
              <div><div className="text-[10px] font-bold uppercase text-muted-foreground">Shop Location</div><div className="mt-1 font-semibold">AutoKita</div></div>
              <div><div className="text-[10px] font-bold uppercase text-muted-foreground">Service Duration</div><div className="mt-1 font-semibold">1h 45m Inspection</div></div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]"><Camera className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Photo Documentation</span></div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {["Front Quarter", "Front Bay Area", "Underchasis"].map((l) => (
                <div key={l} className="text-center">
                  <div className="aspect-video rounded-lg bg-muted flex items-center justify-center text-muted-foreground"><Car className="h-8 w-8" /></div>
                  <div className="mt-2 text-xs">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 text-[color:oklch(0.5_0.2_300)]"><FileText className="h-4 w-4" /><span className="text-xs font-bold uppercase tracking-wider">Mechanical Findings</span></div>
            <div className="mt-4 divide-y">
              {FINDINGS.map((f) => (
                <div key={f.t} className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <div className="font-semibold">{f.t}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{f.d}</div>
                  </div>
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${toneClass(f.tone)}`}>{f.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border-2 border-brand bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Step</div>
            <h3 className="mt-1 text-lg font-bold">Quotation is Being Prepared</h3>
            <p className="mt-2 text-xs text-muted-foreground">Based on these findings, we're putting together your service quotation. You'll be able to review and approve it before any work begins.</p>
            <Link
              href="/dashboard/tracking/quotation"
              className="mt-4 flex w-full items-center justify-center gap-1 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              View Quotation <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Report Highlights</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Brake System</span><span className="rounded-full bg-destructive px-2.5 py-0.5 text-[10px] font-semibold text-white">Urgent</span></div>
              <div className="flex items-center justify-between"><span>Tire Pressure</span><span className="rounded-full bg-[color:oklch(0.6_0.15_240)] px-2.5 py-0.5 text-[10px] font-semibold text-white">Optimal</span></div>
              <div className="flex items-center justify-between"><span>Cabin Air Filters</span><span className="rounded-full bg-warning px-2.5 py-0.5 text-[10px] font-semibold text-white">Monitor</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Inspecting;
