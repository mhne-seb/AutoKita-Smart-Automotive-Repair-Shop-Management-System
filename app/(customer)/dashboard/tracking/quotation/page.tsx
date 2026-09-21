'use client'

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Car, FileText, Clock, AlertCircle, CreditCard, Mail, ShieldCheck, CheckCircle2, Loader2, Wallet, HourglassIcon, BadgeCheck, Lock, Wrench } from "lucide-react";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { TwoFAModal } from "@/components/dashboard/TwoFAModal";
import { toast } from "sonner";
import {
  getQuotationData,
  requestQuotationOtp,
  confirmQuotationVia2FA,
  submitQuotationPayment,
  getQuotationPaymentStatus,
  type PaymentProof,
} from "@/controllers/quotationController";
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from "@/data/diagnosticScan";
import { PAYMENT_CHANNELS } from "@/data/paymentChannels";
import { PaymentModal, type PaymentMethod } from "@/components/dashboard/PaymentModal";

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
  status: string;
  quotation_approved: boolean;
  diagnostic_scan_authorized: boolean;
  vehicle_model: string;
  vehicle_year: number;
  plate_number: string;
};

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
  // Downpayment Policy: 20% required for bills that reach OR exceed PHP 50,000.
  const needsDownpayment = total >= 50000;
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

  // Returns whether the submission actually went through, so the modal knows
  // whether to show its success screen or let the customer fix something and
  // retry (e.g. the quotation got confirmed elsewhere in the meantime).
  const handlePaymentSubmitted = async (
    method: PaymentMethod,
    actual_amount: number,
    proof?: PaymentProof,
  ): Promise<boolean> => {
    if (!jobOrder) return false;
    const acceptedServiceIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => Number(k));
    const res = await submitQuotationPayment(jobOrder.job_order_id, method, actual_amount, acceptedServiceIds, proof);
    if (!res.success) {
      toast.error(res.error ?? "Could not submit your payment. Please try again.");
      return false;
    }
    setPaymentMethod(method);
    setPaymentStatus("pending");
    setJobOrder({ ...jobOrder, quotation_approved: true });
    setShowPay(false);
    return true;
  };

  // The modal owns the code-entry UI; this owns the network round-trips.
  const requestOtp = async () => {
    if (!jobOrder) return null;
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const res = await requestQuotationOtp(userId, jobOrder.job_order_id);
    if (!res.success || !res.token) {
      toast.error(res.message ?? "Could not send the verification code.");
      return null;
    }
    if (res.devCode) toast.message(`Dev only — code: ${res.devCode}`);
    return { token: res.token, sentTo: res.sentTo ?? "your email", expiresMinutes: res.expiresMinutes ?? 10 };
  };

  const submitOtp = async (token: string, code: string): Promise<{ ok: boolean; message?: string }> => {
    if (!jobOrder) return { ok: false };
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const acceptedServiceIds = Object.entries(checked).filter(([, v]) => v).map(([k]) => Number(k));
    const res = await confirmQuotationVia2FA(userId, jobOrder.job_order_id, acceptedServiceIds, token, code);
    if (!res.success) return { ok: false, message: res.message };
    return { ok: true };
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
        <StageStepper active={stageForStatus(jobOrder.status)} viewing="quotation" jobOrderId={jobOrder.job_order_id} />
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
      <StageStepper active={stageForStatus(jobOrder.status)} viewing="quotation" jobOrderId={jobOrder.job_order_id} />

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
            {services.map((s) => {
              // Locked only when the customer genuinely pre-authorized the OBD-II
              // fee at booking (checked via the audit log, not just whether a
              // line item with this name exists — a mechanic can add that line
              // item later, e.g. for an "Others" booking, without the customer
              // ever having agreed to it, and that case must stay untickable
              // like any other service).
              const isAuthorizedFee = s.service_name === DIAGNOSTIC_SCAN_SERVICE_NAME && jobOrder.diagnostic_scan_authorized;
              const frozen = locked || isAuthorizedFee;
              return (
              <label
                key={s.id}
                className={`block rounded-xl border-2 bg-card p-5 ${checked[s.id] ? "border-teal" : "border-border"} ${
                  frozen ? "cursor-not-allowed" : "cursor-pointer"
                } ${locked ? "opacity-80" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={!!checked[s.id]}
                    disabled={frozen}
                    onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })}
                    className="mt-1 h-5 w-5 accent-[color:var(--teal)] disabled:cursor-not-allowed"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 font-bold">
                          {s.service_name}
                          {isAuthorizedFee && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              <Lock className="h-3 w-3" /> Already authorized at booking
                            </span>
                          )}
                        </div>
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
              );
            })}
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
        </aside>
      </div>

      {showPay && !locked && (
        <PaymentModal
          kind="downpayment"
          total={total}
          amount={downpayment}
          optional={!needsDownpayment}
          onClose={() => setShowPay(false)}
          onSubmitted={handlePaymentSubmitted}
        />
      )}
      {show2FA && !locked && (
        <TwoFAModal onClose={() => setShow2FA(false)} onRequest={requestOtp} onSubmit={submitOtp} onVerified={goToInProgress} successTitle="Services Confirmed" successNote="Redirecting you to your service tracker…" />
      )}
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
              : "We're checking your transfer and proof against the shop's account."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Quotation;