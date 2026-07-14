'use client'

// Presentation-only: all mock data 

import { useEffect, useRef, useState } from "react";
import {
  X,
  Upload,
  Download,
  ScanLine,
  AlertTriangle,
  Zap,
  Send,
  Paperclip,
  Maximize2,
  Minimize2,
  MoreVertical,
  FileCheck2,
  Lightbulb,
  Loader2,
  RotateCcw,
  ClipboardList,
  Trash2,
  Bot,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import {
  getDiagnosticSession,
  askDiagnosticAssistant,
  generateQuotationFromPrescription,
  severityChip,
  severityDot,
  peso,
  P0300_BREAKDOWN,
  PARTS_CROSS_CHECK,
  type DiagnosticSession,
  type DiagnosticMsg,
} from "@/controllers/diagnosticAssistantController";

type Msg = DiagnosticMsg;

export function MechanicAIAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [analyzing, setAnalyzing] = useState(true);
  const [quotationDraft, setQuotationDraft] = useState(false);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load the diagnostic session (fault codes, parts, prescription, seed
  // messages) through the controller the first time the widget is opened
  useEffect(() => {
    if (!open || session) return;
    let active = true;
    getDiagnosticSession().then((data) => {
      if (!active) return;
      setSession(data);
      setMessages(data.initialMessages);
    });
    return () => {
      active = false;
    };
  }, [open, session]);

  useEffect(() => {
    if (!open || !session) return;
    const t = setTimeout(() => setAnalyzing(false), 2200);
    return () => clearTimeout(t);
  }, [open, session]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, analyzing]);

  useEffect(() => {
    if (open && session) inputRef.current?.focus();
  }, [open, session]);

  // Close the overflow menu when clicking outside of it.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function botTime() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function pushBotText(text: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "bot", kind: "text", time: botTime(), text }]);
  }

  function pushUser(text: string) {
    const now = botTime();
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", kind: "text", text, time: now }]);
    setInput("");
    askDiagnosticAssistant(text).then(({ reply }) => {
      pushBotText(reply);
    });
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    const withAttachment = attachmentName ? `${t} (attached: ${attachmentName})` : t;
    pushUser(withAttachment);
    setAttachmentName(null);
  }

  function generateQuotation() {
    generateQuotationFromPrescription().then(({ success }) => {
      setQuotationDraft(success);
      if (success) pushBotText("Draft quotation generated from the current service prescription. You can review it under Quotations.");
    });
  }

  function triggerLoadScan() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    setAnalyzing(true);
    pushBotText(`Received "${file.name}". Re-running the diagnostic session against this scan...`);
    getDiagnosticSession().then((data) => {
      setSession(data);
      setTimeout(() => {
        setAnalyzing(false);
        pushBotText("Scan re-analyzed. Fault codes and the service prescription have been refreshed.");
      }, 1600);
    });
    e.target.value = "";
  }

  // "Export" — bundles the current session (fault codes, parts cross-check,
  // service prescription, estimated total) into a downloadable JSON file.
  function exportSession() {
    if (!session) return;
    const payload = {
      vehicle: session.vehicle,
      faultCodes: session.faultCodes,
      servicePrescription: session.servicePrescription,
      estTotal: session.estTotal,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-session-${session.vehicle.model.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearConversation() {
    if (!session) return;
    setMessages(session.initialMessages);
    setQuotationDraft(false);
    setMenuOpen(false);
  }

  function restartDiagnostic() {
    setSession(null);
    setMessages([]);
    setAnalyzing(true);
    setQuotationDraft(false);
    setMenuOpen(false);
  }

  function copySessionSummary() {
    if (!session) return;
    const lines = [
      `${session.vehicle.label} — ${session.vehicle.model}`,
      `Fault codes: ${session.faultCodes.map((f) => `${f.code} (${f.label})`).join(", ")}`,
      `Est. total: ${peso(session.estTotal)}`,
    ].join("\n");
    navigator.clipboard?.writeText(lines);
    setMenuOpen(false);
    pushBotText("Session summary copied to clipboard.");
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AutoKita AI Diagnostic Assistant"
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl hover:opacity-95 ${open ? "hidden" : ""}`}
      >
        <Bot className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {/* Hidden file input shared by "Load Scan" and the composer's paperclip */}
      <input ref={fileInputRef} type="file" accept=".json,.csv,.txt,.log" className="hidden" onChange={handleFileSelected} />

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all ${
              expanded ? "h-[96vh] w-[98vw] max-w-none" : "h-[92vh] w-full max-w-6xl"
            }`}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="text-brand"><Logo /></div>
                <div>
                  <div className="text-sm font-bold">AutoKita AI Diagnostic Assistant</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> OBD2 scan active · Parts & service database loaded
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerLoadScan}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Upload className="h-3.5 w-3.5" /> Load Scan
                </button>
                <button
                  onClick={exportSession}
                  disabled={!session}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </button>
                <button
                  onClick={() => setExpanded((e) => !e)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="rounded-md p-2 hover:bg-accent"
                >
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="More options"
                    className="rounded-md p-2 hover:bg-accent"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-10 w-52 overflow-hidden rounded-lg border bg-card shadow-lg">
                      <button
                        onClick={copySessionSummary}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-accent"
                      >
                        <ClipboardList className="h-3.5 w-3.5" /> Copy session summary
                      </button>
                      <button
                        onClick={clearConversation}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-accent"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Clear conversation
                      </button>
                      <button
                        onClick={restartDiagnostic}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-accent"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Restart diagnostic
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-2 hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!session ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading diagnostic session…
              </div>
            ) : (
              <>
                {/* Scan / fault-code banner */}
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-3">
                  <ScanLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-semibold">{session.vehicle.label}</span>
                  <span className="text-xs text-muted-foreground">· Scanned: {session.vehicle.scanned}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {session.faultCodes.map((f) => (
                      <span
                        key={f.code}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${severityChip[f.severity]}`}
                      >
                        <AlertTriangle className="h-3 w-3" /> {f.code} — {f.label}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600">
                      <Zap className="h-3 w-3" /> {session.faultCodes.length} Codes
                    </span>
                  </div>
                </div>

                {/* Body: chat feed + sidebar */}
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex flex-1 flex-col overflow-hidden">
                    <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/10 px-5 py-4">
                      {messages.map((m) => (
                        <MessageBubble key={m.id} msg={m} />
                      ))}
                      {analyzing && (
                        <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
                          <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                          </span>
                          Analyzing P0113…
                        </div>
                      )}
                    </div>

                    {/* Composer */}
                    <div className="border-t bg-background px-5 py-3">
                      {attachmentName && (
                        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Paperclip className="h-3 w-3" /> {attachmentName}
                          <button onClick={() => setAttachmentName(null)} className="text-rose-500 hover:underline">
                            Remove
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 rounded-full border bg-muted/30 pl-3 pr-1">
                        <button
                          onClick={triggerLoadScan}
                          aria-label="Attach file"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <input
                          ref={inputRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && send()}
                          placeholder="Ask about fault codes, parts, service prescriptions..."
                          className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                        />
                        <button onClick={send} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground hover:opacity-90">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <aside className="hidden w-72 shrink-0 overflow-y-auto border-l bg-background px-4 py-4 lg:block">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Service Prescription</div>
                    <div className="mt-3 space-y-2.5">
                      {session.servicePrescription.map((l) => (
                        <div key={l.name} className="flex items-start justify-between gap-2 text-sm">
                          <span className="flex items-start gap-1.5">
                            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[l.severity]}`} />
                            {l.name}
                          </span>
                          <span className="shrink-0 font-semibold">{peso(l.price)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-xs text-muted-foreground">Est. Total</span>
                      <span className="text-lg font-bold text-teal">{peso(session.estTotal)}</span>
                    </div>
                    <button
                      onClick={generateQuotation}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
                    >
                      <FileCheck2 className="h-4 w-4" /> Generate Quotation
                    </button>
                    {quotationDraft && (
                      <p className="mt-2 text-center text-[11px] text-emerald-600">Draft quotation created from this prescription.</p>
                    )}

                    <div className="mt-6 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Suggested</div>
                    <div className="mt-3 space-y-2">
                      {session.suggestedPrompts.map((p) => (
                        <button
                          key={p}
                          onClick={() => pushUser(p)}
                          className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-left text-xs font-medium hover:bg-accent"
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 border-t pt-4 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Vehicle</div>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <span className="font-semibold">{session.vehicle.model}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Engine</span>
                        <span className="font-semibold">{session.vehicle.engine}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Odometer</span>
                        <span className="font-semibold">{session.vehicle.odometer}</span>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-brand-foreground">{msg.text}</div>
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex max-w-[85%] flex-col">
        {msg.kind === "fault-card" ? (
          <FaultCard />
        ) : (
          <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-sm">{msg.text}</div>
        )}
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    </div>
  );
}

function FaultCard() {
  return (
    <div className="overflow-hidden rounded-2xl rounded-tl-sm border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
        <ScanLine className="h-4 w-4 text-brand" />
        <span className="text-sm font-bold">{P0300_BREAKDOWN.title}</span>
      </div>
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">{P0300_BREAKDOWN.explanation}</div>
      <div className="px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Parts Cross-Check</div>
        <div className="mt-2 space-y-2">
          {PARTS_CROSS_CHECK.map((p) => (
            <div key={p.name} className="flex items-start justify-between gap-2 text-sm">
              <span className="flex items-start gap-1.5">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot[p.severity]}`} />
                <span>
                  <span className="font-semibold">{p.name}</span> <span className="text-muted-foreground">— {p.note}</span>
                </span>
              </span>
              <span className="shrink-0 font-semibold">{peso(p.price)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-start gap-2 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <span className="font-semibold">Rec:</span> {P0300_BREAKDOWN.recommendation}
        </span>
      </div>
    </div>
  );
}
