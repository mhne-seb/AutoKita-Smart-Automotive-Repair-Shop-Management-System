'use client'

// PaymentModal — the customer picks how to pay: cash at the counter, or a
// manual bank / e-wallet transfer with a reference number and a proof
// screenshot the shop verifies by hand. Used twice: the 20% downpayment on
// the quotation, and the remaining balance once the job is done. Only the
// wording differs, so it's a `kind` prop rather than two modals.

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { X, CheckCircle2, Loader2, Store, Send, Copy, Check, Upload, ImageIcon } from "lucide-react";
import { PAYMENT_CHANNELS } from "@/data/paymentChannels";
import type { PaymentProof } from "@/controllers/quotationController";

export type PaymentMethod = "shop" | "ewallet";
export type PaymentKind = "downpayment" | "balance";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

const COPY: Record<PaymentKind, {
  amountLabel: (optional: boolean) => string;
  sendTo: string;
  shopNote: string;
  shopDone: string;
  transferDone: string;
}> = {
  downpayment: {
    amountLabel: (optional) => (optional ? "Downpayment (20%)" : "Required Downpayment (20%)"),
    sendTo: "Send your downpayment to",
    shopNote: "You'll be asked to settle the downpayment in cash or card when you drop off your vehicle at the shop. Your status will show as \"Pending\" here until the shop confirms it was received.",
    shopDone: "Okay, please go to our shop first before confirming. Settle the downpayment at the counter and we'll mark it verified once received.",
    transferDone: "Thanks — we've received your transfer details and proof. The shop will verify it against their account and confirm here shortly.",
  },
  balance: {
    amountLabel: () => "Remaining Balance",
    sendTo: "Send your payment to",
    shopNote: "Settle the balance in cash or card at the counter when you pick up your vehicle. Your status will show as \"Pending\" here until the shop confirms it was received.",
    shopDone: "Noted — pay the balance at the counter when you pick up your vehicle. We'll mark it verified once received.",
    transferDone: "Thanks — we've received your transfer details and proof. The shop will verify it against their account and confirm here shortly.",
  },
};

export function PaymentModal({
  kind,
  total,
  amount,
  optional = false,
  onClose,
  onSubmitted,
}: {
  kind: PaymentKind;
  total: number;
  amount: number;
  optional?: boolean;
  onClose: () => void;
  onSubmitted: (method: PaymentMethod, amount: number, proof?: PaymentProof) => Promise<boolean>;
}) {
  const copy = COPY[kind];
  const [method, setMethod] = useState<PaymentMethod>("shop");
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");

  // Manual transfer proof — only relevant once "Bank / E-Wallet Transfer" is picked.
  const [channelId, setChannelId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedChannel = PAYMENT_CHANNELS.find((c) => c.id === channelId) ?? null;
  const transferReady = Boolean(selectedChannel && referenceNumber.trim() && proofFile);
  const canConfirm = method === "shop" ? true : transferReady;

  useEffect(() => {
    return () => { if (proofPreview) URL.revokeObjectURL(proofPreview); };
  }, [proofPreview]);

  const handleProofChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    if (!file) return;
    if (!ALLOWED_PROOF_TYPES.includes(file.type)) {
      setFileError("Please upload a JPEG, PNG or WebP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setFileError("Image must be under 5MB.");
      e.target.value = "";
      return;
    }
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
  };

  const copyAccountNumber = async () => {
    if (!selectedChannel) return;
    try {
      await navigator.clipboard.writeText(selectedChannel.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied — not worth failing the flow over.
    }
  };

  const confirm = () => {
    if (!canConfirm) return;
    setStatus("processing");
    setTimeout(async () => {
      const proof: PaymentProof | undefined =
        method === "ewallet" && selectedChannel && proofFile
          ? { channelId: selectedChannel.id, referenceNumber: referenceNumber.trim(), file: proofFile }
          : undefined;
      const ok = await onSubmitted(method, amount, proof);
      setStatus(ok ? "success" : "idle");
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {status === "success" ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-semibold">{method === "shop" ? "Payment Method Saved" : "Submitted for Approval"}</div>
            <p className="text-xs text-muted-foreground">{method === "shop" ? copy.shopDone : copy.transferDone}</p>
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
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider"><span>{copy.amountLabel(optional)}</span><span className="text-white/70">Total Bill</span></div>
              <div className="mt-1 flex items-center justify-between"><b className="text-xl">₱{amount.toLocaleString()}</b><b>₱{total.toLocaleString()}</b></div>
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
                <Send className="h-5 w-5 text-brand" /> <span className="text-sm font-semibold">Bank / E-Wallet Transfer</span>
              </button>
            </div>

            {method === "ewallet" && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">1. Where are you sending from?</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_CHANNELS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setChannelId(c.id)}
                        className={`rounded-lg border-2 py-2 text-xs font-semibold ${
                          channelId === c.id ? "border-brand bg-brand-soft/30" : "border-border hover:bg-accent"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedChannel && (
                  <div className="rounded-lg border-2 border-dashed bg-muted/20 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{copy.sendTo}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{selectedChannel.accountName}</p>
                        <p className="text-sm text-muted-foreground">{selectedChannel.accountNumber} · {selectedChannel.label}</p>
                      </div>
                      <button
                        onClick={copyAccountNumber}
                        className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent"
                      >
                        {copied ? <><Check className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">2. Reference number</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    maxLength={50}
                    placeholder="e.g. the transaction/ref no. from your app's receipt"
                    className="w-full rounded-md border p-2.5 text-sm focus:border-brand focus:outline-none"
                    disabled={!selectedChannel}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">3. Upload proof of payment</label>
                  {proofPreview ? (
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <img src={proofPreview} alt="Proof of payment" className="h-16 w-16 shrink-0 rounded-md border object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{proofFile?.name}</p>
                        <p className="text-[10px] text-muted-foreground">{((proofFile?.size ?? 0) / 1024).toFixed(0)} KB</p>
                      </div>
                      <label className="shrink-0 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-accent">
                        Replace
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProofChange} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <label
                      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed p-5 text-center hover:bg-accent ${!selectedChannel ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Click to upload a screenshot</span>
                      <span className="text-[10px] text-muted-foreground">JPEG, PNG or WebP · up to 5MB · required</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProofChange} className="hidden" disabled={!selectedChannel} />
                    </label>
                  )}
                  {fileError && <p className="mt-1.5 text-xs text-destructive">{fileError}</p>}
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This is manually checked against the shop's account — verification may take a little while. Your status will show as "Pending" here until it's confirmed.
                </div>
              </div>
            )}

            {method === "shop" && (
              <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {copy.shopNote}
              </div>
            )}

            <button
              onClick={confirm}
              disabled={status === "processing" || !canConfirm}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "processing" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : method === "ewallet" ? (
                <><CheckCircle2 className="h-4 w-4" /> Submit for Approval</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Confirm Payment</>
              )}
            </button>
            <button onClick={onClose} className="mt-2 w-full rounded-md border py-2 text-sm hover:bg-accent">Cancel</button>
          </>
        )}
      </div>
    </div>
  );
}
