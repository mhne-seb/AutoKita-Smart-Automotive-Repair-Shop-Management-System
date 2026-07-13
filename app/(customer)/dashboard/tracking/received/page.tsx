'use client'

// Route: /dashboard/tracking/received — read-only tracking view for a vehicle that was just received at the shop.
import Link from "next/link";
import { useState, useEffect} from "react";
import { Car, Clock, ShieldCheck, ClipboardList, Wrench, ChevronRight, Info, Calendar, X } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";

const SERVICES = [
  { t: "Engine Oil & Filter Change", d: "Full synthetic oil change with genuine oil filter replacement." },
  { t: "Front Brake Pad Replacement", d: "Replace worn front brake pads and inspect rotors. Immediate attention required." },
];

const HISTORY = [
  { date: "Mar 12, 2026", service: "Full Synthetic Oil Change", total: "₱3,200" },
  { date: "Dec 3, 2025", service: "Battery Replacement", total: "₱5,400" },
  { date: "Aug 21, 2025", service: "Multi-Point Inspection", total: "Free" },
];

function Received() {
  useEffect(() => { document.title = "Vehicle Received — AutoKita"; }, []);

  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="received" />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl bg-brand-soft/60 p-6">
            <div className="flex items-start gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Car className="h-6 w-6" /></div>
              <div>
                <h2 className="text-2xl font-bold">Your Vehicle is Checked In</h2>
                <p className="mt-1 text-sm text-muted-foreground">Vehicle: 2022 Tesla Model 3 (ABC-1234)</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs"><Clock className="h-3 w-3" /> Arrived at 09:15 AM</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs"><ShieldCheck className="h-3 w-3" /> Security Verified</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" /> Scheduled Services</h3>
              <span className="rounded-full border px-3 py-0.5 text-xs">{SERVICES.length} Total Tasks</span>
            </div>
            <div className="mt-3 space-y-3">
              {SERVICES.map((s) => (
                <div key={s.t} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand"><Wrench className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{s.t}</div>
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px]">Pending</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.d}</p>
                      <div className="mt-2 text-xs text-warning">📦 Parts allocation in progress</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" /> Service Notes</h3>
            <div className="mt-3 rounded-xl border bg-card p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer Request</div>
              <p className="mt-1 text-sm italic text-muted-foreground">"Hearing a slight squeak from the front left wheel when cold. Please also check the cabin air filter as it smells a bit musty."</p>
              <div className="mt-4 border-t pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Advisor Remark</div>
              <p className="mt-1 text-sm">Initial visual inspection confirmed standard wear. Added cabin filter check to the multi-point inspection list.</p>
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border-2 border-brand bg-card p-5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estimated Start</div>
            <div className="mt-1 text-3xl font-bold">08:15 <span className="text-lg">AM</span></div>
            <div className="mt-4 flex gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground"><Info className="h-4 w-4 shrink-0 text-brand" /> We aim to begin work within 90 minutes of your check-in time.</div>
            <Link href="/dashboard/tracking/inspecting" className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-brand">View Live Queue <ChevronRight className="h-3 w-3" /></Link>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> Your Service Team</div>
            <p className="mt-2 text-xs text-muted-foreground">A certified AutoKita technician has been assigned to your vehicle and will begin the pre-diagnostic shortly.</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md border px-2.5 py-1 text-xs">Engine Certified</span>
              <span className="rounded-md border px-2.5 py-1 text-xs">EV Certified</span>
            </div>
          </div>

          <button
            onClick={() => setShowHistory(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border bg-card py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
          >
            <Calendar className="h-4 w-4" /> View Service History
          </button>
        </aside>
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Service History</h3>
                <p className="text-sm text-muted-foreground">2022 Tesla Model 3 · ABC-1234</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded-full border p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 divide-y">
              {HISTORY.map((h) => (
                <div key={h.date} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-semibold">{h.service}</div>
                    <div className="text-xs text-muted-foreground">{h.date}</div>
                  </div>
                  <div className="font-medium">{h.total}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowHistory(false)} className="mt-4 w-full rounded-md border py-2 text-sm hover:bg-accent">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Received;
