"use client";

// ScanAuthorizationCard — the customer's side of a mid-inspection OBD-II
// scan request. Only shown when the shop DIDN'T ask about the scanner at
// booking (only 2 of 8 categories do, and "Others" never does) and now
// wants to use it anyway.
//
// No OTP: the fee is fixed and disclosed in the same words every time, so
// being logged in is enough — one plain click either way. OTP stays on the
// mid-service findings flow, where the amount actually varies.

import { useState } from "react";
import { ScanLine, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { respondToScan } from "@/controllers/serviceProgressController";
import { DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";

export function ScanAuthorizationCard({
  authorizationId,
  userId,
  onAnswered,
}: {
  authorizationId: number;
  userId: number;
  onAnswered: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);

  const answer = async (approved: boolean) => {
    setBusy(approved ? "approve" : "decline");
    const r = await respondToScan(userId, authorizationId, approved);
    setBusy(null);
    if (!r.ok) return toast.error(r.message);
    toast.success(approved ? "Approved — the shop can use the scanner now." : "Noted — the scanner won't be used.");
    await onAnswered();
  };

  return (
    <div className="rounded-xl border border-warning/60 bg-card p-5">
      <div className="flex items-start gap-3">
        <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Your mechanic wants to use the diagnostic scanner</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This wasn&apos;t in your original booking. It costs <b>{formatPeso(DIAGNOSTIC_SCAN_FEE)}</b>, billed
            even if no repair follows.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => answer(true)}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={() => answer(false)}
              disabled={busy !== null}
              className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-50"
            >
              {busy === "decline" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {busy === "decline" ? "Declining…" : "Decline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
