'use client'

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Car, FileText, Clock, AlertCircle, CreditCard, Mail, X, ShieldCheck, CheckCircle2, Loader2, Store, Wallet, Send, HourglassIcon, BadgeCheck, Lock, Wrench } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import {
  getQuotationData,
  confirmQuotationVia2FA,
  submitQuotationPayment,
  getQuotationPaymentStatus,
} from "@/controllers/quotationController";

type FetchedService = {
  id: number;
  service_name: string;
  description_of_work: string;
  estimated_hours: number;
  actual_amount: string;
  estimated_amount: string | null;
  parts: any[];
};

type JobOrder = {
  job_order_id: number;
  quotation_approved: boolean;
  vehicle_model: string;
  vehicle_year: number;
  plate_number: string;
};

type PaymentMethod = "shop" | "ewallet";
type PaymentStatus = "none" | "pending" | "confirmed";

function Quotation() {
  useEffect(() => { document.title = "Quotation — AutoKita"; }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [loading, setLoading] = useState(true);
  const [jobOrder, setJobOrder] = useState<JobOrder | null>(null);
  const [quotationStatus, setQuotationStatus] = useState<'preparing' | 'ready'>('preparing');
  const [services, setServices] = useState<FetchedService[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [showPay, setShowPay] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [payChoice, setPayChoice] = useState<"2fa" | "downpayment">("2fa");

  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  const goToInProgress = () => router.push(`/dashboard/tracking/in-progress?jobOrderId=${jobOrder?.job_order_id}`);

  // Locked once the DB says the quotation was already approved/confirmed —
  // this survives reloads and back-navigation, unlike component state.
  const locked = jobOrder?.quotation_approved === true;

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getQuotationData(userId, jobOrderId)
      .then((data) => {
        setJobOrder(data.jobOrder);
        setQuotationStatus(data.quotationStatus || 'ready');
        setServices(data.services);
        setChecked(Object.fromEntries(data.services.map((s) => [s.id, true])));
        if (data.paymentStatus) {
          if (data.paymentStatus.verification_status === "verified") {
            setPaymentStatus("confirmed");
          } else if (data.paymentStatus.verification_status === "pending") {
            setPaymentStatus("pending");
            setPaymentMethod(data.paymentStatus.payment_method === "cash" ? "shop" : "ewallet");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const total = services
    .filter((s) => checked[s.id])
    .reduce((sum, s) => sum + Number(s.actual_amount), 0);
  const needsDownpayment = total > 50000;
  const downpayment = Math.round(total * 0.2);
  const selectedCount = Object.values(checked).filter(Boolean).length;

  // Poll for staff verification once a payment has been submitted — only while unlocked flow is live.
  useEffect(() => {
    if (paymentStatus !== "pending" || !jobOrder || locked === false) return;
    const interval = setInterval(async () => {
      const { paymentStatus: latest } = await getQuotationPaymentStatus(jobOrder.job_order_id);
      if (latest?.verification_status === "verified") {
        setPaymentStatus("confirmed");
        clearInterval(interval);
        setTimeout(goToInProgress, 1200);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [paymentStatus, jobOrder, locked]);

  const handlePaymentSubmitted = async (method: PaymentMethod, actual_amount: number) => {
    if (!jobOrder) return;
    const acceptedServiceIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => Number(k));
    const res = await submitQuotationPayment(jobOrder.job_order_id, method, actual_amount, acceptedServiceIds);
    if (!res.success) return; // e.g. 409 already-confirmed — server is the source of truth
    setPaymentMethod(method);
    setPaymentStatus("pending");
    setJobOrder({ ...jobOrder, quotation_approved: true });
    setShowPay(false);
  };

  const handle2FAVerified = async () => {
    if (!jobOrder) return;
    const acceptedServiceIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => Number(k));
    const res = await confirmQuotationVia2FA(jobOrder.job_order_id, acceptedServiceIds);
    if (!res.success) return;
    goToInProgress();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading quotation…
        </div>
      </div>
    );
  }

  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You don't have any active quotation right now.
        </div>
      </div>
    );
  }

  if (quotationStatus === 'preparing' && !locked) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <StageStepper active="quotation" jobOrderId={jobOrder.job_order_id} />
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Wrench className="mx-auto mb-4 h-12 w-12 text-brand/50" />
          <h2 className="text-lg font-bold text-foreground">Preparing Quotation</h2>
          <p className="mt-2 text-sm">Your quotation is currently being drafted by our expert mechanics. We will notify you once it is ready for your review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="quotation" jobOrderId={jobOrder.job_order_id} />

      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> This quotation has already been confirmed and can no longer be changed.
        </div>
      )}

      <div className="rounded-xl border bg-card p-5">
        <div className="grid grid-cols-4 items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted"><Car className="h-4 w-4 text-brand" /></div>
            <div><div className="text-xs text-muted-foreground">Vehicle</div><div className="font-bold">{jobOrder.vehicle_year} {jobOrder.vehicle_model}</div></div>
          </div>
          <div><div className="text-xs text-muted-foreground">Plate No.</div><div className="font-bold">{jobOrder.plate_number}</div></div>
          <div><div className="text-xs text-muted-foreground">Customer</div><div className="font-bold">Juan Dela Cruz</div></div>
          <div className="text-right"><span className="text-xs text-muted-foreground">Job Order </span><span className="ml-2 rounded-md bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">JO-{jobOrder.job_order_id}</span></div>
        </div>
      </div>

      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-1.5 text-xs font-semibold text-white">👤 Customer — Service Selection</span>
        <span className="ml-3 text-xs text-muted-foreground">
          {locked ? "Your confirmed service selection." : "Select the services you wish to proceed with. Prices are inclusive of parts and labor."}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">{locked ? "Confirmed Services" : "Recommended Services"}</h3>
              <p className="text-xs text-muted-foreground">
                {locked ? "This selection is locked and can no longer be edited." : "Tick the services you would like to confirm. Untick to exclude from quotation."}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{selectedCount}/{services.length} selected</span>
          </div>

          <div className="mt-4 space-y-3">
            {services.map((s) => (
              <label
                key={s.id}
                className={`block rounded-xl border-2 bg-card p-5 ${checked[s.id] ? "border-teal" : "border-border"} ${
                  locked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                }`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={!!checked[s.id]}
                    disabled={locked}
                    onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })}
                    className="mt-1 h-5 w-5 accent-[color:var(--teal)] disabled:cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mt-1 font-bold">{s.service_name}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.description_of_work}</p>
                      </div>
                      <div className="text-right shrink-0">

                        <div className="text-lg font-bold">₱{Number(s.actual_amount).toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">incl. parts & labor</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                          <Clock className="h-3 w-3" /> {Number(s.estimated_hours).toFixed(2)} hrs

                        </span>
                      </div>
                      
                      {s.parts && s.parts.length > 0 && (
                        <div className="mt-2 pl-2 border-l-2 border-muted text-xs text-muted-foreground">
                          <div className="font-semibold text-[10px] uppercase tracking-wider mb-1">Required Parts</div>
                          <ul className="space-y-1">
                            {s.parts.map((p: any, idx: number) => (
                              <li key={idx} className="flex justify-between">
                                <span>{p.quantity}x {p.description || p.part_number}</span>
                                <span>₱{Number(p.total_retail_amount).toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </label>
            ))}
            {services.length === 0 && (
              <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No services have been added to this job order yet.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-xl border">
            <div className="bg-brand p-5 text-brand-foreground">
              <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Your Quotation</div>
              <div className="text-xs text-white/70">Based on selected services</div>
            </div>
            <div className="bg-card p-5">
              <div className="space-y-2 text-sm">
                {services.filter((s) => checked[s.id]).map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="text-teal">●</span> {s.service_name}</span>
                    <span className="font-medium">₱{Number(s.actual_amount).toLocaleString()}</span>
                  </div>
                ))}
                {selectedCount === 0 && <p className="text-xs text-muted-foreground">No services selected yet.</p>}
              </div>
              <div className="mt-4 border-t pt-3 text-sm">
                {/* Est. Duration removed to avoid conflict with actual ML predicted timeline */}
              </div>
              <div className="mt-2 flex flex-col gap-1 items-end">
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold">Total Quotation</span>
                  <span className="text-xl font-bold">₱{total.toLocaleString()}</span>
                </div>
              </div>

              {locked ? (
                <div className="mt-4 rounded-lg bg-success/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" /> Quotation Confirmed
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {paymentStatus !== "none"
                      ? `Confirmed via ${paymentMethod === "shop" ? "Pay at Shop" : "E-Wallet"} payment.`
                      : "Confirmed via 2FA verification."}{" "}
                    This selection can no longer be changed.
                  </p>
                  {paymentStatus !== "none" && <PaymentStatusCard status={paymentStatus} method={paymentMethod} />}
                </div>
              ) : needsDownpayment ? (
                <>
                  <div className="mt-4 rounded-lg bg-[color:oklch(0.97_0.04_50)] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[color:oklch(0.55_0.15_50)]"><AlertCircle className="h-4 w-4" /> Downpayment Required</div>
                    <p className="mt-2 text-xs text-[color:oklch(0.5_0.13_50)]">Your total bill exceeds ₱50,000. A 20% downpayment is required before we begin servicing your vehicle.</p>
                    <div className="mt-3 rounded-lg bg-background p-3">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>Required Downpayment (20%)</span><span>Total Bill</span></div>
                      <div className="mt-1 flex items-center justify-between"><b className="text-lg">₱{downpayment.toLocaleString()}</b><b>₱{total.toLocaleString()}</b></div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPay(true)}
                    disabled={selectedCount === 0}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" /> Proceed to Payment
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPayChoice("2fa")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center ${
                        payChoice === "2fa" ? "border-brand bg-brand-soft/30" : "border-border"
                      }`}
                    >
                      <ShieldCheck className="h-4 w-4 text-teal" />
                      <span className="text-xs font-semibold">Confirm via 2FA</span>
                      <span className="text-[10px] text-muted-foreground">No payment now</span>
                    </button>
                    <button
                      onClick={() => setPayChoice("downpayment")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center ${
                        payChoice === "downpayment" ? "border-brand bg-brand-soft/30" : "border-border"
                      }`}
                    >
                      <Wallet className="h-4 w-4 text-brand" />
                      <span className="text-xs font-semibold">Pay Downpayment</span>
                      <span className="text-[10px] text-muted-foreground">Optional, 20% now</span>
                    </button>
                  </div>

                  {payChoice === "downpayment" ? (
                    <>
                      <div className="mt-3 rounded-lg bg-brand-soft/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-brand" /> Optional Downpayment</div>
                        <p className="mt-2 text-xs text-muted-foreground">Not required for this actual_amount, but paying now can help speed up your drop-off.</p>
                        <div className="mt-3 rounded-lg bg-background p-3">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground"><span>Downpayment (20%)</span><span>Total Bill</span></div>
                          <div className="mt-1 flex items-center justify-between"><b className="text-lg">₱{downpayment.toLocaleString()}</b><b>₱{total.toLocaleString()}</b></div>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowPay(true)}
                        disabled={selectedCount === 0}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CreditCard className="h-4 w-4" /> Proceed to Payment
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="mt-3 rounded-lg bg-brand-soft/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> 2FA Confirmation Required</div>
                        <p className="mt-2 text-xs text-muted-foreground">No payment required now. Confirm your selected services using Two-Factor Authentication.</p>
                      </div>
                      <button
                        onClick={() => setShow2FA(true)}
                        disabled={selectedCount === 0}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Mail className="h-4 w-4" /> Verify & Confirm (2FA)
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {!locked && (
            <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
              <div className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> Parts marked "To Order" may add 1-3 business days to the estimated completion time. The workshop will confirm once parts arrive.</div>
            </div>
          )}

          {locked && (
            <button
              onClick={goToInProgress}
              className="flex w-full items-center justify-center gap-2 rounded-md border bg-card py-2.5 text-sm font-medium hover:border-brand hover:text-brand"
            >
              Go to Service Tracker
            </button>
          )}
        </aside>
      </div>

      {showPay && !locked && (
        <PaymentModal
          total={total}
          downpayment={downpayment}
          optional={!needsDownpayment}
          onClose={() => setShowPay(false)}
          onSubmitted={handlePaymentSubmitted}
        />
      )}
      {show2FA && !locked && <TwoFAModal onClose={() => setShow2FA(false)} onVerified={handle2FAVerified} />}
    </div>
  );
}

function PaymentStatusCard({ status, method }: { status: PaymentStatus; method: PaymentMethod | null }) {
  if (status === "confirmed") {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-lg bg-success/10 p-3">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <div className="text-xs text-muted-foreground">Payment verified.</div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
      <div className="flex items-start gap-3">
        <HourglassIcon className="mt-0.5 h-4 w-4 shrink-0 text-[color:oklch(0.55_0.15_60)] animate-pulse" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[color:oklch(0.5_0.13_50)]">
            {method === "shop" ? "Pending Payment at Shop" : "Pending Verification"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {method === "shop"
              ? "Please settle your downpayment at the shop counter."
              : "We're confirming your GCash/Maya transfer."}
          </p>
        </div>
      </div>
    </div>
  );
}

function TwoFAModal({ onClose, onVerified }: { onClose: () => void; onVerified: () => void | Promise<void> }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [resent, setResent] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const complete = code.length === 6;

  const handleChange = (i: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setStatus("idle");
    if (val && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const verify = () => {
    if (!complete) return;
    setStatus("verifying");
    setTimeout(async () => {
      if (code === "000000") {
        setStatus("success");
        setTimeout(() => onVerified(), 900);
      } else {
        setStatus("error");
      }
    }, 900);
  };

  const resend = () => {
    setDigits(Array(6).fill(""));
    setStatus("idle");
    setResent(true);
    inputsRef.current[0]?.focus();
    setTimeout(() => setResent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold">Verify It's You</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code sent to j••••cruz@gmail.com.</p>
          </div>
          <button onClick={onClose} className="rounded-full border p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {status === "success" ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-semibold">Services Confirmed</div>
            <p className="text-xs text-muted-foreground">Redirecting you to your service tracker…</p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex justify-between gap-2">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputsRef.current[i] = el; }}
                  value={d}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  inputMode="numeric"
                  maxLength={1}
                  className="h-12 w-10 rounded-md border text-center text-lg font-bold focus:border-brand focus:outline-none"
                />
              ))}
            </div>
            {status === "error" && <p className="mt-2 text-xs text-destructive">Incorrect code. Please try again.</p>}
            {resent && <p className="mt-2 text-xs text-success">A new code has been sent.</p>}
            <button
              onClick={verify}
              disabled={!complete || status === "verifying"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "verifying" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>) : "Verify & Confirm"}
            </button>
            <button onClick={resend} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-brand">Didn't get a code? Resend</button>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentModal({
  total,
  downpayment,
  optional,
  onClose,
  onSubmitted,
}: {
  total: number;
  downpayment: number;
  optional?: boolean;
  onClose: () => void;
  onSubmitted: (method: PaymentMethod, actual_amount: number) => void | Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("shop");
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");

  const confirm = () => {
    setStatus("processing");
    setTimeout(async () => {
      await onSubmitted(method, downpayment);
      setStatus("success");
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {status === "success" ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-semibold">Payment Submitted</div>
            <p className="text-xs text-muted-foreground">
              {method === "shop"
                ? "Please settle the downpayment at the shop counter. We'll mark it verified once received."
                : "We'll notify you once your GCash/Maya transfer has been confirmed."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Choose Payment Method</h3>
                <p className="text-sm text-muted-foreground">Select your preferred way to settle this bill.</p>
              </div>
              <button onClick={onClose} className="rounded-full border p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-lg bg-brand p-4 text-brand-foreground">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider"><span>{optional ? "Downpayment (20%)" : "Required Downpayment (20%)"}</span><span className="text-white/70">Total Bill</span></div>
              <div className="mt-1 flex items-center justify-between"><b className="text-xl">₱{downpayment.toLocaleString()}</b><b>₱{total.toLocaleString()}</b></div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => setMethod("shop")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 ${
                  method === "shop" ? "border-brand bg-brand-soft/30" : "border-border"
                }`}
              >
                <Store className="h-5 w-5" /> <span className="text-sm font-semibold">Pay at Shop</span>
              </button>
              <button
                onClick={() => setMethod("ewallet")}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 ${
                  method === "ewallet" ? "border-brand bg-brand-soft/30" : "border-border"
                }`}
              >
                <Send className="h-5 w-5 text-brand" /> <span className="text-sm font-semibold">E-Wallet Transfer</span>
              </button>
            </div>

            {method === "ewallet" && (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center">
                <div className="grid h-40 w-40 place-items-center rounded-lg border bg-white text-xs text-muted-foreground">
                  QR Code Coming Soon
                </div>
                <p className="text-xs text-muted-foreground">
                  Scan this QR code with your GCash or Maya app to send your downpayment. Once GCash/Maya integration is live, this will show a live payment QR.
                </p>
              </div>
            )}

            {method === "shop" && (
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                You'll be asked to settle the downpayment in cash or card when you drop off your vehicle at the shop. Your status will show as "Pending" here until the shop confirms it was received.
              </div>
            )}

            <button
              onClick={confirm}
              disabled={status === "processing"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "processing" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>) : (<><CheckCircle2 className="h-4 w-4" /> Confirm Payment</>)}
            </button>
            <button onClick={onClose} className="mt-2 w-full rounded-md border py-2 text-sm hover:bg-accent">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}

export default Quotation;