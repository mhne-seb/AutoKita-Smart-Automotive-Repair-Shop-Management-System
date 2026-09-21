"use client";

// TwoFAModal — the customer's "verify it's you" step. Opening the modal
// requests an emailed 6-digit code; typing it back is the documented
// go-signal for whatever the caller is confirming (quotation, a mid-service
// finding). The caller does the actual request/submit; this only owns the UI.

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { X, CheckCircle2, Loader2 } from "lucide-react";

export function TwoFAModal({
  onClose,
  onRequest,
  onSubmit,
  onVerified,
  successTitle = "Confirmed",
  successNote,
}: {
  onClose: () => void;
  // Asks the server to email a code; resolves with the signed token to send back with it.
  onRequest: () => Promise<{ token: string; sentTo: string; expiresMinutes: number } | null>;
  // Sends token + typed code; the server does the actual check and the confirm.
  onSubmit: (token: string, code: string) => Promise<{ ok: boolean; message?: string }>;
  onVerified: () => void | Promise<void>;
  // What the green tick says once the code is accepted.
  successTitle?: string;
  successNote?: string;
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [status, setStatus] = useState<"sending" | "idle" | "verifying" | "success" | "error">("sending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [challenge, setChallenge] = useState<{ token: string; sentTo: string; expiresMinutes: number } | null>(null);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const complete = code.length === 6;

  // Send the code the moment the modal opens — opening it IS the request.
  // Guarded by a ref, not an effect cleanup: React Strict Mode (dev) runs
  // mount effects twice, and a cleanup flag only discards the second
  // *response* — the second *email* had already gone out. The ref survives
  // the simulated remount, so exactly one request is ever made per open.
  const requestedOnce = useRef(false);
  useEffect(() => {
    if (requestedOnce.current) return;
    requestedOnce.current = true;
    onRequest().then((c) => {
      if (!c) { onClose(); return; }
      setChallenge(c);
      setStatus("idle");
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const verify = async () => {
    if (!complete || !challenge) return;
    setStatus("verifying");
    setErrorMsg(null);
    const res = await onSubmit(challenge.token, code);
    if (res.ok) {
      setStatus("success");
      setTimeout(() => onVerified(), 900);
    } else {
      setStatus("error");
      setErrorMsg(res.message ?? "Incorrect code. Please try again.");
      setDigits(Array(6).fill(""));
      inputsRef.current[0]?.focus();
    }
  };

  const resend = async () => {
    setDigits(Array(6).fill(""));
    setErrorMsg(null);
    setStatus("sending");
    const c = await onRequest();
    if (!c) { setStatus("idle"); return; }
    setChallenge(c);
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
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "sending" && !challenge
                ? "Sending a code to your email…"
                : <>Enter the 6-digit code sent to <b>{challenge?.sentTo}</b>. It expires in {challenge?.expiresMinutes} minutes.</>}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {status === "success" ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <div className="font-semibold">{successTitle}</div>
            {successNote && <p className="text-xs text-muted-foreground">{successNote}</p>}
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
            {status === "error" && <p className="mt-2 text-xs text-destructive">{errorMsg}</p>}
            {resent && <p className="mt-2 text-xs text-success">A new code has been sent.</p>}
            <button
              onClick={verify}
              disabled={!complete || status === "verifying" || status === "sending"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "verifying" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>) : "Verify & Confirm"}
            </button>
            <button onClick={resend} disabled={status === "sending"} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-brand disabled:opacity-50">
              {status === "sending" && challenge ? "Sending…" : "Didn't get a code? Resend"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
