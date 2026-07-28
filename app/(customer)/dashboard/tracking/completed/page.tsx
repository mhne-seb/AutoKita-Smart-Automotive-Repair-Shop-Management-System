'use client'

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Wrench, ShieldCheck, Printer, Download, CreditCard, Clock } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getCompletedData } from "@/controllers/serviceProgressController";

function formatMoney(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function warrantyDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const months = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return `${months} Month${months === 1 ? "" : "s"}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type CompletedData = Awaited<ReturnType<typeof getCompletedData>>;

function Completed() {
  useEffect(() => { document.title = "Service Completed — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<CompletedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getCompletedData(userId, jobOrderId)
      .then(setData)
      .catch(() => setError("Failed to load service report."))
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">Loading service report…</div>;
  }
  if (error || !data?.jobOrder) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">{error ?? "No completed job order found."}</div>;
  }

  const { jobOrder, logs, warranties, services, parts } = data;

  const laborTotal = services.reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total_retail_amount ?? 0), 0);

  const handleDownload = () => {
    const lines = [
      `AutoKita — Final Service Invoice`,
      `Vehicle: ${jobOrder.vehicle_year} ${jobOrder.vehicle_model} — ${jobOrder.plate_number}`,
      ``,
      `Technician Labor`,
      ...services.map((s) => `  ${s.service_name} (${s.actual_hours ?? s.estimated_hours} hrs)`.padEnd(42) + formatMoney(s.amount)),
      ``,
      `Replaced Parts`,
      ...parts.map((p) => `  ${p.description} x${p.quantity}`.padEnd(42) + formatMoney(p.total_retail_amount)),
      ``,
      `------------------------------------------------`,
      `Total Due`.padEnd(42) + formatMoney(jobOrder.grand_total),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AutoKita_Invoice_JO-${jobOrder.job_order_id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="completed" jobOrderId={jobOrder.job_order_id} />

      <div className="relative overflow-hidden rounded-2xl bg-brand-soft/60 p-8">
        <Check className="absolute right-8 top-8 h-32 w-32 text-brand/10" />
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-7 w-7" /></div>
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">{statusLabel(jobOrder.status)}</span>
              <span className="text-xs text-muted-foreground">JOB ORDER #JO-{jobOrder.job_order_id}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">Your vehicle is ready!</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              The service for your {jobOrder.vehicle_year} {jobOrder.vehicle_model} ({jobOrder.plate_number}) has been completed by our technicians.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Final Service Report</h3>
                <p className="text-xs text-muted-foreground">Log of all work performed on your vehicle.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"><Printer className="h-3 w-3" /> Print</button>
                <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" /> Invoice</button>
              </div>
            </div>
            <div className="mt-4 divide-y">
              {logs.length === 0 && <p className="py-4 text-xs text-muted-foreground">No log entries yet.</p>}
              {logs.map((log) => (
                <div key={log.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Wrench className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground max-w-lg">{log.activity_description}</p>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" /> {formatTime(log.log_time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-teal" /> Warranty Certificates</h3>
              <span className="rounded-full border px-3 py-0.5 text-xs">{warranties.length} Warrant{warranties.length === 1 ? "y" : "ies"}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {warranties.length === 0 && <p className="text-xs text-muted-foreground">No warranties issued for this job order.</p>}
              {warranties.map((w) => (
                <div key={w.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <span className="rounded-full border px-2 py-0.5 text-[10px]">{statusLabel(w.status).toUpperCase()}</span>
                  </div>
                  <div className="mt-3 text-sm font-bold">{w.coverage_description}</div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span>{warrantyDuration(w.start_date, w.expiration_date)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expires:</span><span>{formatDate(w.expiration_date)}</span></div>
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
              {services.length === 0 && <p className="text-xs text-muted-foreground">No labor charges.</p>}
              {services.map((s) => (
                <div key={s.id} className="flex justify-between text-muted-foreground">
                  <span>{s.service_name} ({s.actual_hours ?? s.estimated_hours} hrs)</span>
                  <span>{formatMoney(s.amount)}</span>
                </div>
              ))}

              <div className="mt-3 font-semibold flex items-center gap-1">⚙️ Replaced Parts</div>
              {parts.length === 0 && <p className="text-xs text-muted-foreground">No parts used.</p>}
              {parts.map((p) => (
                <div key={p.id} className="flex justify-between text-muted-foreground">
                  <span>{p.description} x{p.quantity}</span>
                  <span>{formatMoney(p.total_retail_amount)}</span>
                </div>
              ))}

              <div className="mt-3 border-t pt-3 space-y-1">
                <div className="flex justify-between"><span>Labor + Parts</span><b>{formatMoney(laborTotal + partsTotal)}</b></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-semibold">Total Due</span>
                <span className="text-2xl font-bold text-teal">{formatMoney(jobOrder.balance)}</span>
              </div>
              <Link href="/dashboard/billing" className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"><CreditCard className="h-4 w-4" /> Choose Payment Method</Link>
              <p className="mt-2 text-[10px] text-muted-foreground text-center">By proceeding to payment, you confirm that you have reviewed the service report and agree to the charges.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Completed;