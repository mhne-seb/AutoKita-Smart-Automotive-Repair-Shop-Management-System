'use client'

// Route: /dashboard/tracking/completed — read-only tracking view for a vehicle whose service has been completed.
import Link from "next/link";
import { useState, useEffect} from "react";
import { Check, FileText, Wrench, ShieldCheck, Printer, Download, CreditCard, ChevronRight, Clock } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";

const REPORT = [
  { t: "Comprehensive Brake System Service", time: "09:45 AM", d: "Replaced front ceramic brake pads, resurfaced rotors, and performed full brake fluid flush. Tested for optimal stopping distance.", notes: "Torque specs confirmed at 110 Nm. Rotor runout measured within 0.05mm tolerance." },
  { t: "Full Synthetic Oil Change & Filter", time: "10:30 AM", d: "Drained old engine oil, replaced with premium full synthetic. Installed new high-flow oil filter and reset service interval computer.", notes: "Old oil sampled, no metal shavings detected. Next interval set at 10,000 km." },
  { t: "Electronic System Diagnostics", time: "11:15 AM", d: "Performed full OBD-II scan. All sensors reporting within normal parameters. Battery health verified at 94% capacity.", notes: "No stored or pending fault codes. Firmware up to date." },
  { t: "Multi-Point Safety Inspection", time: "12:00 PM", d: "Tire pressure adjusted, coolant levels topped up, suspension components checked for wear. No immediate issues found.", notes: "All four tires set to 34 PSI cold. Coolant topped to full mark." },
];

// Hardcoded invoice text for download as a .txt file
const INVOICE_TEXT = `AutoKita — Final Service Invoice
Customer: Juan Dela Cruz (#CUST-2026-1234)
Vehicle: 2022 Tesla Model 3 (Blue) — ABC-1234

Technician Labor
  Brake System Labor (2.5 hrs)           300.00
  Standard Maintenance (1 hr)              0.00
  Diagnostics Fee (Waiver Applied)         0.00

Replaced Parts
  Front Brake Pad Set (Ceramic)          700.00
  Full Synthetic Oil (6 Qts)             500.00
  Premium Oil Filter                     145.00
  Cabin Air Filter                       300.00

Subtotal                               1,945.00
Shop Supplies & Disposal Fees               0.00
State Sales Tax (8%)                        0.00
------------------------------------------------
Total Due                              1,945.00
`;

function Completed() {
  useEffect(() => { document.title = "Service Completed — AutoKita"; }, []);

  const [showNotes, setShowNotes] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([INVOICE_TEXT], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "AutoKita_Invoice_JO-1234.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="completed" />

      <div className="relative overflow-hidden rounded-2xl bg-brand-soft/60 p-8">
        <Check className="absolute right-8 top-8 h-32 w-32 text-brand/10" />
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-7 w-7" /></div>
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">Ready for Pickup</span>
              <span className="text-xs text-muted-foreground">CUSTOMER ID: #CUST-2026-1234</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">Your vehicle is ready, Juan!</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">The comprehensive inspection and maintenance for your 2022 Tesla Model 3 (Blue) has been successfully completed by our senior technicians.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Final Service Report</h3>
                <p className="text-xs text-muted-foreground">Comprehensive log of all work performed on your vehicle today.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"><Printer className="h-3 w-3" /> Print</button>
                <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" /> PDF</button>
              </div>
            </div>
            <div className="mt-4 divide-y">
              {REPORT.map((r) => (
                <div key={r.t} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Wrench className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">{r.t}</div>
                        <p className="mt-1 text-xs text-muted-foreground max-w-lg">{r.d}</p>
                        <div className="mt-2 flex items-center gap-1 text-xs text-brand"><ShieldCheck className="h-3 w-3" /> Quality Checked by AutoKita Team</div>
                        {showNotes && <p className="mt-2 text-xs text-muted-foreground max-w-lg border-l-2 border-brand/30 pl-2">{r.notes}</p>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {r.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              <button onClick={() => setShowNotes((v) => !v)} className="flex w-full items-center justify-center gap-1 text-sm font-medium hover:text-brand">
                {showNotes ? "Hide Technical Notes" : "View Full Technical Notes"}
                <ChevronRight className={`h-3 w-3 transition-transform ${showNotes ? "rotate-90" : ""}`} />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-teal" /> New Warranty Certificates</h3>
              <span className="rounded-full border px-3 py-0.5 text-xs">3 Active Warranties</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                { t: "Ceramic Brake Pads (Front)", dur: "24 Months / 24k Miles" },
                { t: "High-Flow Oil Filter", dur: "6 Months / 5k Miles" },
                { t: "Cabin Air Filter", dur: "12 Months / 12k Miles" },
              ].map((w) => (
                <div key={w.t} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <span className="rounded-full border px-2 py-0.5 text-[10px]">FULL COVERAGE</span>
                  </div>
                  <div className="mt-3 text-sm font-bold">{w.t}</div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span>{w.dur}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expires:</span><span>July 15, 2026</span></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Warranty coverage applies to both parts and labor. Please keep your digital receipt for any potential claims.</p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Invoice Summary</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-1">🔧 Technician Labor</div>
              {[["Brake System Labor (2.5 hrs)", "300.00"], ["Standard Maintenance (1 hr)", "0.00"], ["Diagnostics Fee (Waiver Applied)", "0.00"]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted-foreground"><span>{k}</span><span>{v}</span></div>
              ))}
              <div className="mt-3 font-semibold flex items-center gap-1">⚙️ Replaced Parts</div>
              {[["Front Brake Pad Set (Ceramic)", "700.00"], ["Full Synthetic Oil (6 Qts)", "500.00"], ["Premium Oil Filter", "145.00"], ["Cabin Air Filter", "300.00"]].map(([k, v]) => (
                <div key={k} className="flex justify-between text-muted-foreground"><span>{k}</span><span>{v}</span></div>
              ))}
              <div className="mt-3 border-t pt-3 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><b>1,945.00</b></div>
                <div className="flex justify-between text-muted-foreground"><span>Shop Supplies & Disposal Fees</span><span>0.00</span></div>
                <div className="flex justify-between text-muted-foreground"><span>State Sales Tax (8%)</span><span>0.00</span></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3"><span className="font-semibold">Total Due</span><span className="text-2xl font-bold text-teal">1,945.00</span></div>
              <Link href="/dashboard/billing" className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"><CreditCard className="h-4 w-4" /> Choose Payment Method</Link>
              <p className="mt-2 text-[10px] text-muted-foreground text-center">By proceeding to payment, you confirm that you have reviewed the service report and agree to the charges. Secure payment options available.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Completed;
