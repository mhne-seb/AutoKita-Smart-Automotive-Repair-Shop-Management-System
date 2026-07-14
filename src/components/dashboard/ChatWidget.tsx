'use client'

// hard coded
import { useEffect, useRef, useState } from "react";
import { X, Maximize2, MoreVertical, Paperclip, Send, ShieldCheck, Clock, Calendar, HelpCircle, Wrench, Bot } from "lucide-react";
import { Logo } from "@/components/site/Logo";

type Msg = { id: string; role: "user" | "bot"; text?: string; time: string; card?: boolean };

const INITIAL: Msg[] = [
  {
    id: "1",
    role: "bot",
    text: "Hello Juan! I'm your AutoKita AI assistant. How can I help you manage your vehicle services today?",
    time: "10:45 AM",
  },
  {
    id: "2",
    role: "user",
    text: "I'd like to check the status of my current service for the Toyota Camry.",
    time: "10:46 AM",
  },
  {
    id: "3",
    role: "bot",
    text: "Sure thing! I've located your active service record. Here's your real-time update:",
    time: "10:46 AM",
    card: true,
  },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function send() {
    const t = input.trim();
    if (!t) return;
    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: t, time: now }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: "Thanks! I'll look into that. In the meantime, you can track your active service or book a new appointment using the quick actions below.",
          time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        },
      ]);
    }, 700);
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AutoKita Assistant"
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl hover:opacity-95 ${open ? "hidden" : ""}`}
      >
        <Bot className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 border-t bg-background px-5 py-3">
              <QuickChip icon={Clock} label="Track Service" />
              <QuickChip icon={Calendar} label="Book Appointment" />
              <QuickChip icon={HelpCircle} label="General FAQs" />
            </div>

            {/* Composer */}
            <div className="border-t bg-background px-5 py-3">
              <div className="flex items-center gap-2 rounded-full border bg-muted/30 pl-3 pr-1">
                <button className="text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button onClick={send} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground hover:opacity-90">
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
      <div className="flex max-w-[80%] flex-col">
        <div className="rounded-2xl rounded-tl-sm bg-card border px-4 py-2.5 text-sm">{msg.text}</div>
        {msg.card && <StatusCard />}
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    </div>
  );
}

function StatusCard() {
  return (
    <div className="mt-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Live Status</span>
        <span className="rounded-md border px-2 py-0.5 text-[10px] font-medium">ID: #AC-88294</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand"><Wrench className="h-5 w-5" /></div>
        <div>
          <div className="text-sm font-bold">2022 Tesla Model 3</div>
          <div className="text-xs text-muted-foreground">Full Engine Diagnostics</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[65%] bg-brand" />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>In Progress</span><span className="font-semibold text-foreground">65%</span>
      </div>
    </div>
  );
}

function QuickChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-accent">
      <Icon className="h-3.5 w-3.5 text-brand" /> {label}
    </button>
  );
}
