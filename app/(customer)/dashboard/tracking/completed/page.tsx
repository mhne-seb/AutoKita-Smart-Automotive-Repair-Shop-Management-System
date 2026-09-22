'use client'

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Wrench, ShieldCheck, Download, Clock, Car, User, PackageCheck, CreditCard, HourglassIcon, AlertCircle, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { PaymentModal, type PaymentMethod } from "@/components/dashboard/PaymentModal";
import type { PaymentProof } from "@/controllers/quotationController";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { getCompletedData, submitBalancePayment } from "@/controllers/serviceProgressController";
import { fetchJobOrderPdfData, generateJobOrderPdf } from "@/lib/jobOrderPdf";

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
  useEffect(() => { document.title = "Billing & Completion — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<CompletedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  const load = () => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    return getCompletedData(userId, jobOrderId)
      .then(setData)
      .catch(() => setError("Failed to load service report."));
  };

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrderIdParam]);

  // Verification and release happen on the admin side — poll until the
  // vehicle is released so those show up here without a reload.
  const stillOpen = Boolean(data?.jobOrder) && !(data?.jobOrder as { released_at?: string | null } | null)?.released_at;
  useEffect(() => {
    if (!stillOpen) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stillOpen, jobOrderIdParam]);

  // Remaining balance → same modal as the downpayment. The server decides the
  // amount; a cash choice is recorded as a pending row the shop confirms at
  // pickup, a transfer as a pending row the shop verifies against its account.
  const handleBalanceSubmitted = async (method: PaymentMethod, _amount: number, proof?: PaymentProof) => {
    if (!data?.jobOrder) return false;
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const res = await submitBalancePayment(data.jobOrder.job_order_id, userId, method, proof);
    if (!res.success) {
      toast.error(res.error ?? "Could not submit your payment.");
      return false;
    }
    void load();
    return true;
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">Loading service report…</div>;
  }
  if (error || !data?.jobOrder) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">{error ?? "No completed job order found."}</div>;
  }

  const { jobOrder, logs, warranties, services, parts } = data;

  // NOTE: release-related fields (released_at / released_to / odometer /
  // release_photo_url) aren't in the current CompletedData shape yet — add
  // them to getCompletedData's return once the release flow is wired up on
  // the admin side. Falling back gracefully below in the meantime.
  const releasedAt = (jobOrder as any).released_at ?? null;
  const releasedTo = (jobOrder as any).released_to ?? "Customer / Authorized Representative";
  const releasePhoto = (jobOrder as any).release_photo_url ?? null;

  const laborTotal = services.reduce((sum, s) => sum + Number(s.actual_amount ?? 0), 0);
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total_retail_amount ?? 0), 0);
  // Money comes from the live bill, not job_orders.balance (never written).
  const bill = data.bill;
  const balanceDue = bill?.balance ?? laborTotal + partsTotal;
  const latestPayment = bill?.latestPayment ?? null;
  const paymentPending = latestPayment?.verification_status === "pending";
  const paymentRejected = latestPayment?.verification_status === "rejected" && balanceDue > 0;

  // The same Job Order document the shop prints (see lib/jobOrderPdf).
  const handleDownload = async () => {
    if (!jobOrder) return;
    const d = await fetchJobOrderPdfData(jobOrder.job_order_id);
    if (!d) return toast.error("Could not build the job order PDF.");
    await generateJobOrderPdf(d);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active={stageForStatus(jobOrder.status)} viewing={jobOrder.status === "completed" ? "billing" : "completed"} jobOrderId={jobOrder.job_order_id} />

      <div className="relative overflow-hidden rounded-2xl bg-brand-soft/60 p-8">
        <Check className="absolute right-8 top-8 h-32 w-32 text-brand/10" />
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-7 w-7" /></div>
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">{statusLabel(jobOrder.status)}</span>
              <span className="text-xs text-muted-foreground">JOB ORDER #JO-{jobOrder.job_order_id}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">{jobOrder.status === "completed" ? "Billing & Payment" : "Final Service Report"}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {jobOrder.status === "completed"
                ? `Work on your ${jobOrder.vehicle_year} ${jobOrder.vehicle_model} (${jobOrder.plate_number}) is done and road-tested. Settle the balance below and the shop will release your vehicle.`
                : `Complete summary for your ${jobOrder.vehicle_year} ${jobOrder.vehicle_model} (${jobOrder.plate_number}) — services performed, parts and labor, payment, warranties, and release details.`}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" /> Download</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 font-bold"><Wrench className="h-4 w-4" /> Services Performed</h3>
            <p className="text-xs text-muted-foreground">Full log of all work completed on your vehicle.</p>
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

          {/* --- Vehicle Release Information --- */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 font-bold"><Car className="h-4 w-4" /> Vehicle Release Information</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Released To</div>
                  <div className="text-sm font-medium">{releasedTo}</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Released At</div>
                  <div className="text-sm font-medium">
                    {releasedAt ? `${formatDate(releasedAt)} · ${formatTime(releasedAt)}` : "Pending release"}
                  </div>
                </div>
              </div>
            </div>
            {releasePhoto ? (
              <img src={releasePhoto} alt="Vehicle release proof" className="mt-4 aspect-video w-full max-w-md rounded-lg border object-cover" />
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                <PackageCheck className="h-4 w-4" /> Release photo will appear here once the vehicle has been handed back.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Payment Summary</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-1">🔧 Technician Labor</div>
              {services.length === 0 && <p className="text-xs text-muted-foreground">No labor charges.</p>}
              {services.map((s) => (
                <div key={s.id} className="flex justify-between text-muted-foreground">
                  <span>{s.service_name} ({s.actual_hours ?? s.estimated_hours} hrs)</span>
                  <span>{formatMoney(s.actual_amount)}</span>
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
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold">{formatMoney(bill?.total ?? laborTotal + partsTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Paid (verified)</span>
                <span>− {formatMoney(bill?.paid ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">Balance Due</span>
                <span className={`text-2xl font-bold ${balanceDue <= 0 ? "text-success" : "text-teal"}`}>{formatMoney(balanceDue)}</span>
              </div>
            </div>

            {/* What happens next depends on where the money is. */}
            {balanceDue <= 0 ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm font-semibold text-success">
                <BadgeCheck className="h-4 w-4" /> {releasedAt ? "Paid in full — vehicle released" : "Paid in full — ready for pickup"}
              </div>
            ) : paymentPending ? (
              <div className="mt-4 rounded-lg bg-warning/15 p-3 text-xs">
                <div className="flex items-center gap-2 text-sm font-semibold text-[color:oklch(0.55_0.15_60)]">
                  <HourglassIcon className="h-4 w-4" /> Pending verification
                </div>
                <p className="mt-1 text-muted-foreground">
                  {latestPayment?.payment_method === "cash"
                    ? `You chose to pay ₱${formatMoney(latestPayment.amount_paid)} at the counter. The shop will mark it verified once received.`
                    : `Your ${latestPayment?.payment_channel ?? "transfer"} of ₱${formatMoney(latestPayment?.amount_paid)} is being checked against the shop's account.`}
                </p>
                {latestPayment?.payment_method === "cash" && (
                  <button onClick={() => setShowPay(true)} className="mt-2 text-xs font-semibold text-brand hover:underline">
                    Pay by bank / e-wallet instead
                  </button>
                )}
              </div>
            ) : (
              <>
                {paymentRejected && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Your last payment couldn't be verified. Please check the reference number and re-upload a clear screenshot, or pay at the counter.
                  </div>
                )}
                <button
                  onClick={() => setShowPay(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                >
                  <CreditCard className="h-4 w-4" /> Pay Remaining Balance
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {showPay && bill && balanceDue > 0 && (
        <PaymentModal
          kind="balance"
          total={bill.total}
          amount={balanceDue}
          onClose={() => setShowPay(false)}
          onSubmitted={handleBalanceSubmitted}
        />
      )}
    </div>
  );
}

export default Completed;

// ---------------------------------------------------------------------------
// PDF generation — same visual format as the History page's downloadable
// invoice (logo header, SERVICE INVOICE title, details block, itemized
// DESCRIPTION/AMOUNT table covering both labor and parts, total, footer note),
// just sourced from the completed job order's data instead of a history row.
// ---------------------------------------------------------------------------
