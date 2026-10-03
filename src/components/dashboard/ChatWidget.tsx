'use client'

import { uid } from '@/lib/utils'
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Maximize2, MoreVertical, Paperclip, Send, ShieldCheck, Clock, Calendar, HelpCircle, Wrench, Bot } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { formatChatMarkdown } from "@/lib/chatMarkdown";
import { DraggableChatTrigger } from "./DraggableChatTrigger";

export interface LiveJobCardData {
  id: number;
  jobOrderNumber: string;
  vehicle: string;
  plateNumber?: string;
  serviceName: string;
  rawStatus: string;
  statusLabel: string;
  progressPercent: number;
  trackingSlug?: string;
}

type Msg = {
  id: string;
  role: "user" | "bot";
  text?: string;
  time: string;
  card?: boolean;
  jobCardData?: LiveJobCardData | null;
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [activeJob, setActiveJob] = useState<LiveJobCardData | null>(null);

  // Multi-turn conversation history sent to the API
  const conversationHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const sessionIdRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial load: Fetch real customer profile, active job order, and chat history from Supabase
  useEffect(() => {
    const storedIdRaw = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null;
    const userId = storedIdRaw ? parseInt(storedIdRaw, 10) : null;

    fetch(`/api/chat/customer${userId ? `?userId=${userId}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        if (data.activeJob) {
          setActiveJob(data.activeJob);
        }

        // If customer has previous message history in Supabase, load it
        if (data.recentMessages && data.recentMessages.length > 0) {
          setMessages(data.recentMessages);
          conversationHistory.current = data.recentMessages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text || '',
          }));
        } else {
          // Clean personalized welcome message connected to Supabase user
          const firstName = data.user?.firstName || '';
          const welcomeGreeting = firstName
            ? `Hello ${firstName}! I'm your AutoKita AI assistant. How can I help you manage your vehicle services today?`
            : "Hello! I'm your AutoKita AI assistant. How can I help you manage your vehicle services today?";

          setMessages([
            {
              id: 'welcome',
              role: 'bot',
              text: welcomeGreeting,
              time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            },
          ]);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize customer chat from Supabase:', err);
        setMessages([
          {
            id: 'welcome',
            role: 'bot',
            text: "Hello! I'm your AutoKita AI assistant. How can I help you manage your vehicle services today?",
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          },
        ]);
      });
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send(customText?: string) {
    const t = (customText ?? input).trim();
    if (!t || waiting) return;
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages((m) => [...m, { id: uid(), role: "user", text: t, time: now }]);
    if (!customText) setInput("");
    setWaiting(true);

    // Optimistically push the user message to conversation history.
    // We'll roll it back if the request fails so history stays clean.
    const historyBeforeSend = [...conversationHistory.current];
    conversationHistory.current = [...historyBeforeSend, { role: 'user', content: t }];

    const isAdmin = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_admin') === 'true' : false;
    const storedIdRaw = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null;
    const parsedId = storedIdRaw ? parseInt(storedIdRaw, 10) : undefined;
    const validId = !isNaN(parsedId as number) ? parsedId : undefined;
    const employeeId = isAdmin ? validId : undefined;
    const customerUserId = !isAdmin ? validId : undefined;

    fetch('/api/chat/customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory.current,
        sessionId: sessionIdRef.current,
        userId: customerUserId,
        employeeId: employeeId,
      }),
    })
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          // Rollback user message from history so it doesn't get re-sent
          // on the next successful request
          conversationHistory.current = historyBeforeSend;
          const errText = data.error ?? data.message ?? 'Something went wrong. Please try again.';
          setMessages((m) => [
            ...m,
            {
              id: uid(),
              role: 'bot' as const,
              text: `⚠️ ${errText}`,
              time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            },
          ]);
          return;
        }

        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        if (data.activeJob) {
          setActiveJob(data.activeJob);
        }

        const reply: string = data.reply ?? '';

        // Only add the assistant reply to history on success
        conversationHistory.current = [
          ...conversationHistory.current,
          { role: 'assistant', content: reply },
        ];

        // Show live status card if inquiry is about vehicle tracking and an active job exists in Supabase
        const isStatusInquiry = /\b(status|track|tracking|progress|update|my car|my vehicle|my service|ongoing|current service)\b/i.test(t);
        const resolvedJob = data.activeJob ?? activeJob;
        const shouldShowCard = Boolean((data.showJobCard || isStatusInquiry) && resolvedJob);

        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: 'bot',
            text: reply,
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            card: shouldShowCard,
            jobCardData: shouldShowCard ? resolvedJob : null,
          },
        ]);
      })
      .catch(() => {
        // Network-level failure — rollback history too
        conversationHistory.current = historyBeforeSend;
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: 'bot',
            text: '⚠️ Network error. Please check your connection and try again.',
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          },
        ]);
      })
      .finally(() => setWaiting(false));
  }

  return (
    <>
      {/* Movable floating trigger button */}
      <DraggableChatTrigger
        open={open}
        onClick={() => setOpen(true)}
        ariaLabel="Open AutoKita Assistant"
        title="AutoKita AI Assistant (Drag to move or click to open)"
        storageKey="autokita_customer_chat_btn_pos"
      />

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div
            className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl ${
              expanded ? "h-[90vh] w-[90vw] max-w-5xl" : "h-[85vh] w-full max-w-2xl"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="text-brand"><Logo /></div>
                <div>
                  <div className="text-sm font-bold">AutoKita Assistant</div>
                  <div className="text-xs text-muted-foreground">AI Support Agent</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpanded((e) => !e)} className="rounded-md p-2 hover:bg-accent"><Maximize2 className="h-4 w-4" /></button>
                <button className="rounded-md p-2 hover:bg-accent"><MoreVertical className="h-4 w-4" /></button>
                <button onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-accent"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/20 px-5 py-4">
              <div className="flex justify-center">
                <span className="rounded-full bg-muted px-3 py-0.5 text-[11px] text-muted-foreground">Today</span>
              </div>
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {waiting && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions wired to live Supabase flows */}
            <div className="flex flex-wrap gap-2 border-t bg-background px-5 py-3">
              <QuickChip
                icon={Clock}
                label="Track Service"
                disabled={waiting}
                onClick={() => send("I'd like to check the status of my current service.")}
              />
              <QuickChip
                icon={Calendar}
                label="Book Appointment"
                disabled={waiting}
                onClick={() => send("I would like to book an appointment for my vehicle.")}
              />
              <QuickChip
                icon={HelpCircle}
                label="General FAQs"
                disabled={waiting}
                onClick={() => send("What are your shop hours, location, and services offered?")}
              />
            </div>

            {/* Composer */}
            <div className="border-t bg-background px-5 py-3">
              <div className={`flex items-center gap-2 rounded-full border pl-3 pr-1 transition-colors ${waiting ? 'bg-muted/10 opacity-60' : 'bg-muted/30'}`}>
                <button className="text-muted-foreground hover:text-foreground" disabled={waiting}><Paperclip className="h-4 w-4" /></button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !waiting && send()}
                  placeholder={waiting ? "Waiting for response..." : "Type your message..."}
                  disabled={waiting}
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />
                <button
                  onClick={() => send()}
                  disabled={waiting}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-success" /> End-to-end encrypted for your security</span>
                <span className="font-semibold">AI • POWERED BY AUTOKITA</span>
              </div>
            </div>
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
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><Bot className="h-4 w-4" /></div>
      <div className="flex max-w-[85%] flex-col">
        <div className="rounded-2xl rounded-tl-sm bg-card border px-4 py-2.5 text-sm prose prose-sm max-w-none leading-relaxed
          [&_strong]:font-semibold
          [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5
          [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
          [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatChatMarkdown(msg.text ?? '')}</ReactMarkdown>
        </div>
        {msg.card && msg.jobCardData && <StatusCard job={msg.jobCardData} />}
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    </div>
  );
}

function StatusCard({ job }: { job: LiveJobCardData }) {
  const trackingSlug = job.trackingSlug || 'in-progress';
  const trackingUrl = `/dashboard/tracking/${trackingSlug}?jobOrderId=${job.id}`;

  return (
    <div className="mt-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Live Status</span>
        <span className="rounded-md border px-2 py-0.5 text-[10px] font-medium text-foreground">
          {job.jobOrderNumber || `ID: #JO-${job.id}`}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{job.vehicle}</div>
          <div className="truncate text-xs text-muted-foreground">
            {job.serviceName || 'Automotive Service'}
            {job.plateNumber ? ` • ${job.plateNumber}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-brand transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(5, job.progressPercent))}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{job.statusLabel}</span>
        <span className="font-semibold text-brand">{job.progressPercent}%</span>
      </div>
      <div className="mt-3 border-t pt-2.5">
        <Link
          href={trackingUrl}
          className="inline-flex w-full items-center justify-center rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-brand-foreground"
        >
          View Full Tracking
        </Link>
      </div>
    </div>
  );
}

function QuickChip({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-accent active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Icon className="h-3.5 w-3.5 text-brand" /> {label}
    </button>
  );
}
