"use client";

// FindingApprovalCard — the customer's side of a mid-service finding. Shows
// what the mechanic found (with photo), what it would add to the bill, and
// two answers: Approve (emailed code, like the quotation) or Decline (no
// code — declining adds nothing). Either way the shop keeps the record.

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { ServiceFinding } from "@/data/types";
import { TwoFAModal } from "@/components/dashboard/TwoFAModal";
import { requestFindingOtp, respondToFinding } from "@/controllers/findingsController";
import { FINDING_TIMEOUT_HOURS, findingAgeHours, findingIsOverdue } from "@/data/findingPolicy";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function FindingApprovalCard({
  finding,
  userId,
  onAnswered,
  onViewPhoto,
}: {
  finding: ServiceFinding;
  userId: number;
  onAnswered: () => void | Promise<void>;
  onViewPhoto: (url: string) => void;
}) {
  const [show2FA, setShow2FA] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declining, setDeclining] = useState(false);

  const when = new Date(finding.createdAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  // Shop policy: answer within 4 hours or the vehicle is moved to staging.
  const overdue = findingIsOverdue(finding.createdAt);
  const hoursLeft = Math.max(0, Math.round((FINDING_TIMEOUT_HOURS - findingAgeHours(finding.createdAt)) * 10) / 10);

  const requestOtp = async () => {
    const r = await requestFindingOtp(userId, finding.id);
    if (!r.ok) { toast.error(r.message); return null; }
    return { token: r.token, sentTo: r.sentTo, expiresMinutes: r.expiresMinutes, forWork: r.forWork };
  };
  const submitOtp = (token: string, code: string) => respondToFinding(userId, finding.id, true, { token, code });

  const decline = async () => {
    setDeclining(true);
    const r = await respondToFinding(userId, finding.id, false);
    setDeclining(false);
    if (!r.ok) return toast.error(r.message);
    setShowDecline(false);
    toast.success("Noted — the shop will continue with your approved services.");
    await onAnswered();
  };

  return (
    <div className="rounded-xl border border-warning/60 bg-card p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Your mechanic {finding.taskTitle ? "found something" : "noticed something"}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {finding.taskTitle ? `While working on ${finding.taskTitle}` : "Found while your vehicle was in the shop"} · {when}
          </p>

          <p className="mt-3 text-sm">{finding.findings}</p>

          {finding.photoUrl && (
            <button type="button" onClick={() => onViewPhoto(finding.photoUrl!)} className="mt-3 block overflow-hidden rounded-lg border">
              <img src={finding.photoUrl} alt="What the mechanic found" className="h-28 w-44 object-cover transition-transform hover:scale-105" />
            </button>
          )}

          <div className="mt-4 divide-y rounded-lg border text-sm">
            {finding.services.map((s) => (
              <div key={s.name} className="flex items-center justify-between px-3 py-2">
                <span>{s.name} <span className="text-xs text-muted-foreground">· labor</span></span>
                <span>{peso(s.price)}</span>
              </div>
            ))}
            {finding.parts.map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-center justify-between px-3 py-2">
                <span>{p.name} <span className="text-xs text-muted-foreground">· ×{p.qty}</span></span>
                <span>{peso(p.unitPrice * p.qty)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between bg-muted/30 px-3 py-2 font-semibold">
              <span>Added to your bill if approved</span>
              <span>{peso(finding.extraCost)}</span>
            </div>
          </div>

          <p className={`mt-3 text-xs font-semibold ${overdue ? "text-destructive" : "text-warning"}`}>
            {overdue
              ? `The ${FINDING_TIMEOUT_HOURS}-hour response window has passed — the shop may move your vehicle to staging until you decide.`
              : `Please answer within ${FINDING_TIMEOUT_HOURS} hours of the request (about ${hoursLeft} h left) so work isn't held up.`}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Approving sends a code to your email. Your approved services continue either way; if you decline, this stays on your record as a recommendation.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setShow2FA(true)}
              disabled={declining}
              className="flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => setShowDecline(true)}
              className="rounded-md border px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              Decline
            </button>
          </div>
        </div>
      </div>

      {showDecline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !declining && setShowDecline(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold">Decline this additional work?</h3>
              <button onClick={() => setShowDecline(false)} disabled={declining} className="rounded-md p-1 transition-colors hover:bg-accent" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Your approved services continue as planned. The recommendation stays on your record so you can have it done another time.
            </p>
            <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
              {finding.services.map((s) => (
                <div key={s.name} className="flex items-center justify-between"><span className="text-muted-foreground">{s.name}</span><span className="font-medium">{peso(s.price)}</span></div>
              ))}
              {finding.parts.map((p, i) => (
                <div key={`${p.name}-${i}`} className="flex items-center justify-between"><span className="text-muted-foreground">{p.name} ×{p.qty}</span><span className="font-medium">{peso(p.unitPrice * p.qty)}</span></div>
              ))}
              <div className="flex items-center justify-between border-t pt-2"><span className="text-muted-foreground">Not added to your bill</span><span className="font-semibold">{peso(finding.extraCost)}</span></div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={decline}
                disabled={declining}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-destructive py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                {declining && <Loader2 className="h-4 w-4 animate-spin" />} Yes, decline
              </button>
              <button onClick={() => setShowDecline(false)} disabled={declining} className="flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50">
                Keep thinking
              </button>
            </div>
          </div>
        </div>
      )}

      {show2FA && (
        <TwoFAModal
          onClose={() => setShow2FA(false)}
          onRequest={requestOtp}
          onSubmit={submitOtp}
          onVerified={async () => { setShow2FA(false); toast.success("Approved — the shop can go ahead."); await onAnswered(); }}
          successTitle="Additional Work Approved"
          successNote="It's been added to your service timeline."
        />
      )}
    </div>
  );
}
