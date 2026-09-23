'use client'

import { uid } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  X,
  Download,
  Send,
  Maximize2,
  Minimize2,
  MoreVertical,
  ClipboardList,
  Trash2,
  RotateCcw,
  Bot,
  Loader2,
  Search,
  ChevronRight,
  Wrench,
  Package,
  Car,
  FileText,
  ArrowLeft,
} from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import {
  getDiagnosticSession,
  searchJobOrders,
  getSuggestedPrompts,
  peso,
  type DiagnosticMsg,
} from '@/controllers/diagnosticAssistantController'
import type {
  JobOrderSession,
  JobOrderSummary,
  JobOrderService,
  JobOrderPart,
  InspectionNote,
} from '@/types/jobOrder'

// ─── Status Helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  inspecting:                'bg-sky-100 text-sky-700',
  pending_customer_approval: 'bg-amber-100 text-amber-700',
  in_progress:               'bg-blue-100 text-blue-700',
  waiting_on_parts:          'bg-orange-100 text-orange-700',
  revision_pending:          'bg-purple-100 text-purple-700',
  completed:                 'bg-emerald-100 text-emerald-700',
  released:                  'bg-slate-100 text-slate-600',
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Picker Screen ────────────────────────────────────────────────────────────

function JobOrderPicker({
  onSelect,
}: {
  onSelect: (joId: number) => void
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<JobOrderSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent JOs on mount
  useEffect(() => {
    setLoading(true)
    searchJobOrders('')
      .then(setResults)
      .catch(() => setError('Failed to load job orders.'))
      .finally(() => setLoading(false))
  }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      setError(null)
      searchJobOrders(q)
        .then(setResults)
        .catch(() => setError('Search failed. Please try again.'))
        .finally(() => setLoading(false))
    }, 300)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Select a Job Order</p>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by plate number, vehicle model, or JO #…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-rose-500">
            <span>{error}</span>
          </div>
        ) : results.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Search className="h-6 w-6 opacity-40" />
            <span>No job orders found.</span>
          </div>
        ) : (
          <div className="divide-y">
            {!query && (
              <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Recent Job Orders
              </div>
            )}
            {results.map((jo) => (
              <button
                key={jo.id}
                onClick={() => onSelect(jo.id)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-accent"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Car className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">JO #{jo.id}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="truncate text-xs text-muted-foreground">{jo.plate_number}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {jo.vehicle_make} {jo.vehicle_model}{jo.vehicle_year ? ` ${jo.vehicle_year}` : ''}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[jo.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabel(jo.status)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{jo.jo_date}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const WELCOME_MESSAGE: DiagnosticMsg = {
  id: 'welcome',
  role: 'bot',
  kind: 'text',
  time: '',
  text: "Hi! I'm the AutoKita AI assistant. I can help verify OEM parts and fitment, provide official workshop manual procedures, torque specifications, and diagnose OBD-II codes.\n\nYou can click any test query on the right, chat freely, or **load a job order** for vehicle-specific context.",
}

export function MechanicAIAssistant() {
  const [open, setOpen]           = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)

  // JO picker panel visibility (overlay, not a full phase)
  const [pickerOpen, setPickerOpen]           = useState(false)
  const [session, setSession]                 = useState<JobOrderSession | null>(null)
  const [loadingSession, setLoadingSession]   = useState(false)
  const [sessionError, setSessionError]       = useState<string | null>(null)

  // Chat state — starts immediately in chat mode
  const [messages, setMessages]       = useState<DiagnosticMsg[]>([WELCOME_MESSAGE])
  const [input, setInput]             = useState('')
  const [waiting, setWaiting]         = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [tokensRemaining, setTokensRemaining] = useState<number | null>(null)
  const [toolStatus, setToolStatus]   = useState<'none' | 'sql' | 'pinecone' | 'both'>('none')

  const conversationHistory = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  // Persisted across panel re-opens via sessionStorage so the same DB session is reused
  const sessionIdRef = useRef<number | null>(
    typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem('autokita_ai_session_id') ?? '', 10) || null
      : null
  )
  const scrollRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const menuRef     = useRef<HTMLDivElement>(null)

  // Auto-scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, waiting])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Close overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  // Load chat history when the panel opens
  useEffect(() => {
    if (!open) {
      // Only reset UI state, NOT the sessionId — it persists in sessionStorage
      setSession(null)
      setSessionError(null)
      setPickerOpen(false)
      return
    }

    const employeeIdRaw = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null
    const employeeId = employeeIdRaw ? parseInt(employeeIdRaw, 10) : null
    if (!employeeId || isNaN(employeeId)) return // guest / unauthenticated — skip history load

    setHistoryLoading(true)
    fetch(`/api/chat/admin/history?employee_id=${employeeId}&limit=40`)
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (data.sessionId && data.messages?.length > 0) {
          // Restore DB session ID so new messages go into the same session
          sessionIdRef.current = data.sessionId
          sessionStorage.setItem('autokita_ai_session_id', String(data.sessionId))
          // Rebuild the UI messages list from history + welcome message
          const historyMsgs: DiagnosticMsg[] = data.messages.map(
            (m: { role: string; text: string; time: string }) => ({
              id: uid(),
              role: m.role as 'user' | 'bot',
              kind: 'text' as const,
              text: m.text,
              time: m.time,
            })
          )
          setMessages([WELCOME_MESSAGE, ...historyMsgs])
          // Rebuild conversationHistory ref so the AI has context for follow-up questions
          conversationHistory.current = data.messages
            .filter((m: { role: string }) => m.role === 'user' || m.role === 'bot')
            .map((m: { role: string; text: string }) => ({
              role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.text,
            }))
        }
      })
      .catch(() => { /* silently skip if history load fails */ })
      .finally(() => setHistoryLoading(false))
  }, [open])

  // ── Job Order Selection ─────────────────────────────────────────────────────

  async function handleJobOrderSelect(joId: number) {
    setLoadingSession(true)
    setSessionError(null)
    try {
      const data = await getDiagnosticSession(joId)
      setSession(data)
      sessionIdRef.current = null // Start fresh session for new JO
      // Append a context-loaded message to the existing conversation
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'bot' as const,
          kind: 'text' as const,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
          text: `Job order **#${data.id}** loaded — **${data.vehicle.make} ${data.vehicle.model}${data.vehicle.year ? ` ${data.vehicle.year}` : ''}** (${data.vehicle.plate}), status: **${statusLabel(data.status)}**.\n\nI now have the vehicle info, ${data.services.length} service(s), ${data.parts.length} part(s), and ${data.inspectionNotes.length} inspection note(s). What would you like to know?`,
        },
      ])
      setPickerOpen(false)
    } catch (err) {
      setSessionError((err as Error).message ?? 'Failed to load job order.')
    } finally {
      setLoadingSession(false)
    }
  }

  function handleClearJO() {
    setSession(null)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'bot' as const,
        kind: 'text' as const,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        text: 'Job order unloaded. I\'m back in general mode — feel free to keep asking anything!',
      },
    ])
    conversationHistory.current = []
    sessionIdRef.current = null
    setMenuOpen(false)
  }

  // ── Chat ────────────────────────────────────────────────────────────────────

  function botTime() {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  function pushBotText(text: string) {
    setMessages((m) => [...m, { id: uid(), role: 'bot', kind: 'text', time: botTime(), text }])
  }

  const pushUser = useCallback((text: string) => {
    const now = botTime()
    setMessages((m) => [...m, { id: uid(), role: 'user', kind: 'text', text, time: now }])
    setInput('')
    setWaiting(true)
    setToolStatus('none')

    conversationHistory.current = [...conversationHistory.current, { role: 'user', content: text }]
    const historyToSend = conversationHistory.current.slice(-6)

    const employeeIdRaw = typeof window !== 'undefined' ? sessionStorage.getItem('autokita_user_id') : null
    const employeeId = employeeIdRaw ? parseInt(employeeIdRaw, 10) : undefined

    fetch('/api/chat/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: historyToSend,
        sessionId: sessionIdRef.current,
        employeeId: isNaN(employeeId as number) ? undefined : employeeId,
        vehicleId: session?.vehicle?.id,
        // Inject live JO context so AI always knows what JO we're discussing
        ...(session?.contextString ? { jobOrderContext: session.contextString } : {}),
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId
          // Persist the active session ID so it survives panel close/reopen
          sessionStorage.setItem('autokita_ai_session_id', String(data.sessionId))
        }
        if (!res.ok) { pushBotText(data.error ?? 'Something went wrong.'); return }
        const reply: string = data.reply ?? ''
        conversationHistory.current = [...conversationHistory.current, { role: 'assistant', content: reply }]
        if (data.tokensRemaining !== undefined) setTokensRemaining(data.tokensRemaining)
        if (data.toolCallStatus) setToolStatus(data.toolCallStatus)
        pushBotText(reply)
      })
      .catch(() => pushBotText('Network error. Please check your connection.'))
      .finally(() => setWaiting(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  function send() {
    const t = input.trim()
    if (!t) return
    pushUser(t)
  }

  function clearConversation() {
    setMessages([{
      id: uid(),
      role: 'bot',
      kind: 'text',
      time: botTime(),
      text: session
        ? 'Conversation cleared. JO context is still loaded — ask me anything about this job order.'
        : 'Conversation cleared. Ask me anything!',
    }])
    conversationHistory.current = []
    // Start a fresh DB session on next send
    sessionIdRef.current = null
    sessionStorage.removeItem('autokita_ai_session_id')
    setMenuOpen(false)
  }

  function exportSession() {
    if (!session) {
      pushBotText('No job order is loaded — load a job order first to export session data.')
      return
    }
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `jo-${session.id}-session.json`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  function copySessionSummary() {
    if (!session) {
      pushBotText('No job order loaded — load a job order first to copy its summary.')
      setMenuOpen(false)
      return
    }
    navigator.clipboard?.writeText(session.contextString)
    setMenuOpen(false)
    pushBotText('Session summary copied to clipboard.')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AutoKita AI Diagnostic Assistant"
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:shadow-xl hover:opacity-95 ${open ? 'hidden' : ''}`}
      >
        <Bot className="h-6 w-6" strokeWidth={2.25} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className={`relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all ${
            expanded ? 'h-[96vh] w-[98vw] max-w-none' : 'h-[92vh] w-full max-w-5xl'
          }`}>

            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="text-brand"><Logo /></div>
                <div>
                  <div className="text-sm font-bold">AutoKita AI Diagnostic Assistant</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {session ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        JO #{session.id} loaded · Parts &amp; service database active
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        General mode · No job order loaded
                      </>
                    )}
                    {tokensRemaining !== null && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                        {tokensRemaining.toLocaleString()} tokens left today
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Load / Change JO button — always visible */}
                <button
                  onClick={() => { setPickerOpen(true); setSessionError(null) }}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {session ? 'Change JO' : 'Load JO'}
                </button>
                {session && (
                  <button
                    onClick={exportSession}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                )}
                <button onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Collapse' : 'Expand'} className="rounded-md p-2 hover:bg-accent">
                  {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenuOpen((v) => !v)} aria-label="More options" className="rounded-md p-2 hover:bg-accent">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-10 w-52 overflow-hidden rounded-lg border bg-card shadow-lg">
                      <button onClick={copySessionSummary} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-accent">
                        <ClipboardList className="h-3.5 w-3.5" /> Copy session summary
                      </button>
                      <button onClick={clearConversation} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-accent">
                        <Trash2 className="h-3.5 w-3.5" /> Clear conversation
                      </button>
                      {session && (
                        <button onClick={handleClearJO} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-rose-600 hover:bg-accent">
                          <RotateCcw className="h-3.5 w-3.5" /> Unload job order
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-2 hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── JO Picker Overlay (slides over the chat) ── */}
            {pickerOpen && (
              <div className="absolute inset-0 z-20 flex flex-col bg-card">
                <div className="flex items-center justify-between border-b px-5 py-4">
                  <span className="text-sm font-semibold">Load a Job Order</span>
                  <button
                    onClick={() => { setPickerOpen(false); setSessionError(null) }}
                    className="rounded-md p-2 hover:bg-accent"
                    aria-label="Close picker"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {loadingSession ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading job order…
                  </div>
                ) : sessionError ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm">
                    <span className="text-rose-500">{sessionError}</span>
                    <button onClick={() => setSessionError(null)} className="text-xs text-brand underline">Try again</button>
                  </div>
                ) : (
                  <JobOrderPicker onSelect={handleJobOrderSelect} />
                )}
              </div>
            )}

            {/* ── Chat (always rendered) ── */}
            <>
              {/* Job order banner — only shown when a JO is loaded */}
              {session && (
                <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-5 py-2.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-bold">JO #{session.id}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs font-semibold">{session.vehicle.plate}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    {session.vehicle.make} {session.vehicle.model}{session.vehicle.year ? ` ${session.vehicle.year}` : ''}
                  </span>
                  <span className={`ml-auto inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[session.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {statusLabel(session.status)}
                  </span>
                </div>
              )}

              {/* Body: chat + sidebar */}
              <div className="flex flex-1 overflow-hidden">

                {/* Chat feed */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/10 px-5 py-4">
                    {historyLoading && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading conversation history…
                      </div>
                    )}
                    {messages.map((m) => (
                      <MessageBubble key={m.id} msg={m} />
                    ))}
                    {waiting && (
                      <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                        </span>
                        {toolStatus === 'both'      ? '🧠 Querying knowledge base & live data…'
                        : toolStatus === 'sql'      ? '🔍 Looking up live data…'
                        : toolStatus === 'pinecone' ? '📚 Searching knowledge base…'
                        : '🤖 Thinking…'}
                      </div>
                    )}
                  </div>

                  {/* Composer */}
                  <div className="border-t bg-background px-5 py-3">
                    <div className="flex items-center gap-2 rounded-full border bg-muted/30 pl-4 pr-1">
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && send()}
                        placeholder={session ? 'Ask about this job order, parts, services…' : 'Ask about parts fitment, torque specs, manual procedures, OBD-II codes…'}
                        className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <button onClick={send} className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-brand-foreground hover:opacity-90">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sidebar */}
                <aside className="hidden w-64 shrink-0 overflow-y-auto border-l bg-background px-4 py-4 lg:block">
                  {session ? (
                    <>
                      {/* Services */}
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <Wrench className="h-3 w-3" /> Services
                      </div>
                      {session.services.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {session.services.map((s: JobOrderService, i: number) => (
                            <div key={i} className="flex items-start justify-between gap-2 text-xs">
                              <span className="text-foreground">{s.service_name}</span>
                              <span className="shrink-0 font-semibold text-muted-foreground">
                                {s.actual_amount != null ? peso(s.actual_amount) : peso(s.estimated_amount)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between border-t pt-2">
                            <span className="text-[10px] text-muted-foreground">Total</span>
                            <span className="text-sm font-bold text-teal-600">
                              {peso(session.services.reduce((sum: number, s: JobOrderService) => sum + (s.actual_amount ?? s.estimated_amount ?? 0), 0))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No services recorded.</p>
                      )}

                      {/* Parts */}
                      <div className="mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <Package className="h-3 w-3" /> Parts Used
                      </div>
                      {session.parts.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {session.parts.map((p: JobOrderPart, i: number) => (
                            <div key={i} className="flex items-start justify-between gap-2 text-xs">
                              <span className="text-foreground">
                                {p.description || p.part_number}
                                {p.quantity > 1 && <span className="text-muted-foreground"> ×{p.quantity}</span>}
                              </span>
                              <span className="shrink-0 font-semibold text-muted-foreground">{peso(p.total)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No parts recorded.</p>
                      )}

                      {/* Inspection Notes */}
                      {session.inspectionNotes.length > 0 && (
                        <>
                          <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Inspection Findings
                          </div>
                          <div className="mt-2 space-y-2">
                            {session.inspectionNotes.filter(n => n.findings || n.notes).slice(0, 5).map((n: InspectionNote, i: number) => (
                              <div key={i} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                                <div className="font-semibold">{n.name}</div>
                                <div className="mt-0.5 text-amber-700">{n.findings || n.notes}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Vehicle Info */}
                      <div className="mt-5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <Car className="h-3 w-3" /> Vehicle
                      </div>
                      <div className="mt-2 space-y-1.5 text-xs">
                        {[
                          ['Plate', session.vehicle.plate],
                          ['Make', session.vehicle.make],
                          ['Model', session.vehicle.model],
                          ['Year', session.vehicle.year?.toString() ?? '—'],
                          ['Mileage', session.vehicle.mileage != null ? `${Number(session.vehicle.mileage).toLocaleString()} km` : '—'],
                          ['Type', session.vehicle.vehicle_type ?? '—'],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">{value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Suggested Prompts */}
                      <div className="mt-5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Suggested
                      </div>
                      <div className="mt-2 space-y-2">
                        {getSuggestedPrompts(session.status).map((p) => (
                          <button
                            key={p}
                            onClick={() => pushUser(p)}
                            className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-left text-xs font-medium hover:bg-accent"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    /* No-JO sidebar: two parts for testing (Parts Inquiries & Manuals Inquiries) */
                    <>
                      {/* Part 1: Parts Inquiries */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
                          <Package className="h-3.5 w-3.5 text-blue-600" />
                          Parts Inquiries
                        </div>
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          Fitment &amp; OEM
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          'What is the OEM part number for the oil filter on a 2010 Toyota Hilux?',
                          'Verify front brake pad part number for 2012 Toyota Hiace',
                          'What is the OEM fuel filter for Toyota Hilux 2.5 D-4D?',
                          'Search for spark plug part numbers for Toyota Vios 1.5L',
                          'Check alternator part number for 2008 Toyota Vios',
                        ].map((p) => (
                          <button
                            key={p}
                            onClick={() => pushUser(p)}
                            className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-left text-xs font-medium transition hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      {/* Part 2: Manuals Inquiries */}
                      <div className="mt-5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
                          <Wrench className="h-3.5 w-3.5 text-amber-600" />
                          Manuals Inquiries
                        </div>
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          SSTs &amp; Specs
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          'What are the torque specs and procedure to replace front brake pads on a 2012 Toyota Hiace?',
                          'What are the SSTs and procedure for replacing shock absorbers on a Hilux?',
                          'What does OBD code P0301 mean and what manual checks are needed?',
                          'What is the alternator belt inspection procedure and deflection spec for Vios?',
                          'Diagnostic steps and causes for OBD code P0171 (System Too Lean)',
                        ].map((p) => (
                          <button
                            key={p}
                            onClick={() => pushUser(p)}
                            className="w-full rounded-lg border bg-muted/20 px-3 py-2 text-left text-xs font-medium transition hover:border-amber-400 hover:bg-amber-50/60 hover:text-amber-900 dark:hover:bg-amber-950/40 dark:hover:text-amber-200"
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                      <div className="mt-5 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Testing Tip:</span> Click any inquiry to test the structured Parts Verification Record or the Official Workshop Manual Guide.
                      </div>
                    </>
                  )}
                </aside>
              </div>
            </>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: DiagnosticMsg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-brand-foreground">
          {msg.text}
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    )
  }
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex max-w-[85%] flex-col">
        <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-sm prose prose-sm max-w-none
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
          [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold
          [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
          [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
          [&_ul]:my-1.5 [&_ul]:pl-5 [&_ul]:list-disc
          [&_ol]:my-1.5 [&_ol]:pl-5 [&_ol]:list-decimal
          [&_li]:my-0.5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text ?? ''}</ReactMarkdown>
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground">{msg.time}</span>
      </div>
    </div>
  )
}
