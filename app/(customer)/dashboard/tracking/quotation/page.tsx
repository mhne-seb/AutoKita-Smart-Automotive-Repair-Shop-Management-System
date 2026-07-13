'use client'

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Car, FileText, Clock, Wrench, Package, AlertCircle, CreditCard, Mail, X, Upload, Paperclip, ShieldCheck, CheckCircle2, Loader2, Store, Wallet, Send, HourglassIcon, BadgeCheck } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";

type Svc = { id: string; title: string; desc: string; price: number; labor: string; laborCost: string; parts: string; stock: string; stockOk: boolean; tag?: string; tagTone?: "order" | "special" };

const SERVICES: Svc[] = [
  { id: "SVC-001", title: "Engine Oil & Filter Change", desc: "Full synthetic oil change with genuine oil filter replacement.", price: 3200, labor: "1.5 hrs labor", laborCost: "₱1,800 labor", parts: "₱1,400 parts", stock: "2 in stock", stockOk: true },
  { id: "SVC-002", title: "Front Brake Pad Replacement", desc: "Replace worn front brake pads and inspect rotors. Immediate attention required.", price: 7050, labor: "2 hrs labor", laborCost: "₱2,500 labor", parts: "₱4,550 parts", stock: "1 in stock", stockOk: true, tag: "1 to order", tagTone: "order" },
  { id: "SVC-003", title: "Air Filter Replacement", desc: "Replace clogged engine air filter for optimal performance.", price: 1800, labor: "0.5 hrs labor", laborCost: "₱600 labor", parts: "₱1,200 parts", stock: "1 in stock", stockOk: true, tag: "1 to order", tagTone: "order" },
  { id: "SVC-005", title: "Suspension Overhaul", desc: "Full replacement of front and rear suspension components for restored ride quality.", price: 39500, labor: "8 hrs labor", laborCost: "₱12,000 labor", parts: "₱27,900 parts", stock: "to order", stockOk: false, tag: "special order", tagTone: "special" },
];

type PaymentMethod = "shop" | "ewallet";
type PaymentStatus = "none" | "pending" | "confirmed";

function Quotation() {
  useEffect(() => { document.title = "Quotation — AutoKita"; }, []);

  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({ "SVC-001": true, "SVC-002": true, "SVC-003": true, "SVC-005": true });
  const [showPay, setShowPay] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  // When the bill is below the mandatory downpayment threshold, the customer
  // can still choose to pay a downpayment voluntarily instead of just doing 2FA.
  const [payChoice, setPayChoice] = useState<"2fa" | "downpayment">("2fa");

  // Tracks the state of a submitted downpayment so the customer can see
  // whether it's still waiting on shop/staff verification or already confirmed.
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("none");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);

  const total = SERVICES.filter((s) => checked[s.id]).reduce((sum, s) => sum + s.price, 0);
  const needsDownpayment = total > 50000;
  const downpayment = Math.round(total * 0.2);
  const selectedCount = Object.values(checked).filter(Boolean).length;
  const wantsDownpayment = needsDownpayment || payChoice === "downpayment";

  const goToInProgress = () => router.push("/dashboard/tracking/in-progress");

  // Simulates staff/backend verification of a submitted downpayment.
  useEffect(() => {
    if (paymentStatus !== "pending") return;
    const t = setTimeout(() => {
      setPaymentStatus("confirmed");
      setTimeout(goToInProgress, 1200);
    }, 5000);
    return () => clearTimeout(t);

  }, [paymentStatus]);

  const handlePaymentSubmitted = (method: PaymentMethod, ref: string | null) => {
    setPaymentMethod(method);
    setPaymentRef(ref);
    setPaymentStatus("pending");
    setShowPay(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="quotation" />

      <div className="rounded-xl border bg-card p-5">
        <div className="grid grid-cols-4 items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted"><Car className="h-4 w-4 text-brand" /></div>
            <div><div className="text-xs text-muted-foreground">Vehicle</div><div className="font-bold">2022 Tesla Model 3</div></div>
          </div>
          <div><div className="text-xs text-muted-foreground">Plate No.</div><div className="font-bold">ABC-1234</div></div>
          <div><div className="text-xs text-muted-foreground">Customer</div><div className="font-bold">Juan Dela Cruz</div></div>
          <div className="text-right"><span className="text-xs text-muted-foreground">Job Order </span><span className="ml-2 rounded-md bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">JO-1234</span></div>
        </div>
      </div>

      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-teal px-4 py-1.5 text-xs font-semibold text-white">👤 Customer — Service Selection</span>
        <span className="ml-3 text-xs text-muted-foreground">Select the services you wish to proceed with. Prices are inclusive of parts and labor.</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">Recommended Services</h3>
              <p className="text-xs text-muted-foreground">Tick the services you would like to confirm. Untick to exclude from quotation.</p>
            </div>
            <span className="text-xs text-muted-foreground">{selectedCount}/{SERVICES.length} selected</span>
          </div>

          <div className="mt-4 space-y-3">
            {SERVICES.map((s) => (
              <label key={s.id} className={`block cursor-pointer rounded-xl border-2 bg-card p-5 ${checked[s.id] ? "border-teal" : "border-border"}`}>
                <div className="flex items-start gap-4">
                  <input type="checkbox" checked={!!checked[s.id]} onChange={(e) => setChecked({ ...checked, [s.id]: e.target.checked })} className="mt-1 h-5 w-5 accent-[color:var(--teal)]" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{s.id}</span>
                          {s.tag && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.tagTone === "order" ? "bg-warning/20 text-[color:oklch(0.55_0.15_60)]" : "bg-warning/20 text-[color:oklch(0.55_0.15_60)]"}`}>📦 {s.tag}</span>}
                        </div>
                        <div className="mt-1 font-bold">{s.title}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold">₱{s.price.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">incl. parts & labor</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock className="h-3 w-3" /> {s.labor}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Wrench className="h-3 w-3" /> {s.laborCost}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Package className="h-3 w-3" /> {s.parts}</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs ${s.stockOk ? "text-success" : "text-warning"}`}>● {s.stock}</span>
                    </div>
                  </div>
                </div>
              </label>
            ))}
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
                {SERVICES.filter((s) => checked[s.id]).map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><span className="text-teal">●</span> {s.title}</span>
                    <span className="font-medium">₱{s.price.toLocaleString()}</span>
                  </div>
                ))}
                {selectedCount === 0 && <p className="text-xs text-muted-foreground">No services selected yet.</p>}
              </div>
              <div className="mt-4 border-t pt-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Est. Duration</span><b>{selectedCount * 3} hrs</b></div></div>
              <div className="mt-2 flex items-center justify-between"><span className="font-semibold">Total Quotation</span><span className="text-xl font-bold">₱{total.toLocaleString()}</span></div>

              {/* --- Payment status: shown once a downpayment has been submitted --- */}
              {paymentStatus !== "none" ? (
                <PaymentStatusCard status={paymentStatus} method={paymentMethod} reference={paymentRef} />
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
                  {/* Bill is below ₱50k — downpayment isn't required, but the
                      customer can still opt into paying one now if they'd rather
                      not wait for a 2FA prompt later. */}
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
                        <p className="mt-2 text-xs text-muted-foreground">Not required for this amount, but paying now can help speed up your drop-off.</p>
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

          <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
            <div className="flex gap-2"><AlertCircle className="h-4 w-4 shrink-0" /> Parts marked "To Order" may add 1-3 business days to the estimated completion time. The workshop will confirm once parts arrive.</div>
          </div>
        </aside>
      </div>

      {showPay && (
        <PaymentModal
          total={total}
          downpayment={downpayment}
          optional={!needsDownpayment}
          onClose={() => setShowPay(false)}
          onSubmitted={handlePaymentSubmitted}
        />
      )}
      {show2FA && <TwoFAModal onClose={() => setShow2FA(false)} onVerified={goToInProgress} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment status card — once a downpayment has been
// submitted, so the customer can tell at a glance whether it's still waiting
// on verification or already confirmed, instead of assuming it went through.
// ---------------------------------------------------------------------------
function PaymentStatusCard({ status, method, reference }: { status: PaymentStatus; method: PaymentMethod | null; reference: string | null }) {
  if (status === "confirmed") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-lg bg-success/10 p-4">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <div className="text-sm font-semibold text-success">Payment Verified</div>
          <p className="mt-1 text-xs text-muted-foreground">Taking you to your service tracker…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4">
      <div className="flex items-start gap-3">
        <HourglassIcon className="mt-0.5 h-5 w-5 shrink-0 text-[color:oklch(0.55_0.15_60)] animate-pulse" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[color:oklch(0.5_0.13_50)]">
            {method === "shop" ? "Pending Payment at Shop" : "Pending Verification"}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {method === "shop"
              ? "Please settle your downpayment at the shop counter and mention your Job Order number. This will update automatically once staff confirms receipt."
              : "We're reviewing your uploaded proof and reference number. This usually takes a few minutes."}
          </p>
          {reference && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-[11px] font-mono">
              Ref: {reference}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TwoFAModal({ onClose, onVerified }: { onClose: () => void; onVerified: () => void }) {
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
    setTimeout(() => {
      setStatus("success");
      setTimeout(onVerified, 900);
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

// ---------------------------------------------------------------------------
// E-wallet QR / account details shown when E-Wallet Transfer is selected
// ---------------------------------------------------------------------------
const WALLETS: { name: string; number: string }[] = [
  { name: "GCash", number: "0917-123-4567" },
  { name: "Maya", number: "0908-765-4321" },
];

// GCash/Maya reference numbers are numeric-ish alphanumeric strings, typically
// 10-13 characters
const REF_PATTERN = /^[A-Za-z0-9]{10,13}$/;

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
  onSubmitted: (method: PaymentMethod, reference: string | null) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("shop");
  const [fileName, setFileName] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState("");
  const [refTouched, setRefTouched] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFileName(e.target.files[0].name);
  };

  const refValid = REF_PATTERN.test(refNumber.trim());
  const refError = refTouched && refNumber.trim().length > 0 && !refValid
    ? "Reference number should be 10–13 letters/numbers, exactly as shown in your wallet app."
    : refTouched && refNumber.trim().length === 0
    ? "Reference number is required to verify your transfer."
    : null;

  // Pay at Shop is settled in person, so no proof is required — but it will
  // still show as "pending" until staff confirms receipt (see PaymentStatusCard).
  // E-Wallet Transfer requires both a screenshot AND a valid reference number,
  // so a mistyped or copy-pasted wrong reference can't slip through.
  const canConfirm = method === "shop" || (!!fileName && refValid);

  const confirm = () => {
    setRefTouched(true);
    if (!canConfirm) return;
    setStatus("processing");
    setTimeout(() => {
      setStatus("success");
      setTimeout(() => onSubmitted(method, method === "ewallet" ? refNumber.trim() : null), 1000);
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
                : "We'll notify you once your reference number and proof are verified."}
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
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Wallet className="h-3 w-3" /> Payment Details
                  </div>
                  {WALLETS.map((w) => (
                    <div key={w.name} className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 p-3">
                      <div className="text-xs">
                        <div className="text-sm font-bold">{w.name}</div>
                        <div>Account Name: <b>AutoCare Services</b></div>
                        <div>Mobile Number: <b>{w.number}</b></div>
                      </div>
                      <div className="text-center">
                        <div className="grid h-16 w-16 place-items-center rounded border bg-white p-1 text-[8px]">QR</div>
                        <div className="mt-1 text-[10px]">{w.name} QR</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Upload Payment Proof
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                  {fileName ? (
                    <div className="mt-2 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
                      <span className="flex items-center gap-2"><Paperclip className="h-3 w-3" /> {fileName}</span>
                      <button onClick={() => setFileName(null)} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                  ) : (
                    <label className="mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center hover:bg-muted/30">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">Drag and drop or click to upload PDF/JPG</p>
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />
                    </label>
                  )}

                  <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reference Number
                  </div>
                  <input
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    onBlur={() => setRefTouched(true)}
                    placeholder="e.g. 0123456789"
                    className={`mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono focus:outline-none ${
                      refError ? "border-destructive" : "focus:border-brand"
                    }`}
                  />
                  {refError ? (
                    <p className="mt-1.5 text-[11px] text-destructive">{refError}</p>
                  ) : (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">Copy this exactly from your GCash/Maya transaction receipt.</p>
                  )}
                </div>
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
              disabled={status === "processing" || (method === "ewallet" && !!fileName && refTouched && !refValid)}
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
