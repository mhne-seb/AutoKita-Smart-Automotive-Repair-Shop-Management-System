'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ShieldCheck,
  Eye,
  Search,
  X,
  User,
  Calendar,
  Database,
  Hash,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { getAuditLogs, type AuditLogEntry } from '@/controllers/databaseController'

export default function page() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All Actions')
  const [entityFilter, setEntityFilter] = useState('All Entities')
  const [detailTarget, setDetailTarget] = useState<AuditLogEntry | null>(null)

  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await getAuditLogs()
      setLogs(data)
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [])

  const actions = useMemo(() => {
    return Array.from(new Set(logs.map((e) => e.action))).sort()
  }, [logs])

  const entityTypes = useMemo(() => {
    return Array.from(new Set(logs.map((e) => e.entityType))).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((entry) => {
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        entry.id.toLowerCase().includes(q) ||
        entry.user.toLowerCase().includes(q) ||
        entry.employee.toLowerCase().includes(q) ||
        entry.entityId.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.entityType.toLowerCase().includes(q) ||
        (entry.ticketAcceptance?.acceptedBy && entry.ticketAcceptance.acceptedBy.toLowerCase().includes(q)) ||
        (entry.ticketAcceptance?.assignedMechanic && entry.ticketAcceptance.assignedMechanic.toLowerCase().includes(q))

      const matchesAction = actionFilter === 'All Actions' || entry.action === actionFilter
      const matchesEntity = entityFilter === 'All Entities' || entry.entityType === entityFilter
      return matchesSearch && matchesAction && matchesEntity
    })
  }, [logs, search, actionFilter, entityFilter])

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Database Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor changes and system audit trails in the database.</p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-accent transition-all disabled:opacity-50"
          title="Refresh live audit logs"
        >
          <RefreshCw size={15} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-[#1d3a68] pl-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Database Administration</h3>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ShieldCheck size={15} className="text-emerald-600" /> Role-Based Access Protected
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by user, employee, entity ID, or action..."
                className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none"
            >
              <option>All Actions</option>
              {actions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground focus:outline-none"
            >
              <option>All Entities</option>
              {entityTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="ml-auto text-sm font-semibold text-muted-foreground">
              {filtered.length} of {logs.length} entries
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 font-semibold">ID</th>
                  <th className="py-3 font-semibold">User / Employee</th>
                  <th className="py-3 font-semibold">Action Performed</th>
                  <th className="py-3 font-semibold">Entity Type</th>
                  <th className="py-3 font-semibold">Entity ID</th>
                  <th className="py-3 font-semibold">Date</th>
                  <th className="py-3 font-semibold text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw size={24} className="animate-spin text-muted-foreground" />
                        <span>Loading audit logs from live database...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No log entries match your search or filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/60 transition-colors hover:bg-accent/40 last:border-0">
                      <td className="py-4 font-semibold text-muted-foreground">{entry.id}</td>
                      <td className="py-4">
                        <p className="font-semibold text-foreground">User: {entry.user}</p>
                        <p className="text-sm text-muted-foreground">
                          Employee:{' '}
                          <span className={entry.ticketAcceptance ? 'font-semibold text-blue-600' : ''}>
                            {entry.employee}
                          </span>
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{entry.action}</span>
                          {entry.ticketAcceptance && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              Ticket Accepted
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-muted-foreground">{entry.entityType}</td>
                      <td className="py-4 font-semibold text-foreground">{entry.entityId}</td>
                      <td className="py-4 text-muted-foreground">
                        <div>{entry.date}</div>
                        {entry.time && <div className="text-xs text-muted-foreground/75">{entry.time}</div>}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          aria-label="View details"
                          onClick={() => setDetailTarget(entry)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white transition-opacity hover:opacity-90 active:scale-95"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detailTarget && <LogDetailModal entry={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log detail modal — shown when the eye icon is clicked.
// ---------------------------------------------------------------------------

function LogDetailModal({ entry, onClose }: { entry: AuditLogEntry; onClose: () => void }) {
  const [showRaw, setShowRaw] = useState(false)
  const changes = entry.diff

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-card border border-border shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-6 py-4">
          <div>
            <p className="font-bold text-white text-base">Log Entry {entry.id}</p>
            <p className="text-xs text-white/70">System audit log recorded in database</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 px-6 py-5 overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User size={12} /> Performed By
              </p>
              <p className="mt-1 font-semibold text-foreground">User: {entry.user}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Employee: <span className="font-medium text-foreground">{entry.employee}</span>
              </p>
            </div>
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar size={12} /> Date & Time
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.date}</p>
              {entry.time && <p className="text-xs text-muted-foreground mt-0.5">{entry.time}</p>}
            </div>
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database size={12} /> Entity Type
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.entityType}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{entry.rawEntityType}</p>
            </div>
            <div className="rounded-xl bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash size={12} /> Entity ID
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.entityId}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">Row #{entry.rawEntityId}</p>
            </div>
          </div>

          {/* Action Performed */}
          <div className="rounded-xl border border-border p-3.5 bg-background">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action Performed</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{entry.action}</p>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                {entry.rawAction}
              </span>
            </div>
          </div>

          {/* Ticket Acceptance Dedicated Section */}
          {entry.ticketAcceptance && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20 p-4">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
                <CheckCircle2 size={16} />
                <span>Ticket Acceptance Record</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Accepted By Employee:</span>
                  <p className="font-bold text-foreground mt-0.5">{entry.ticketAcceptance.acceptedBy}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Assigned Mechanic:</span>
                  <p className="font-bold text-foreground mt-0.5">{entry.ticketAcceptance.assignedMechanic}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Service Ticket:</span>
                  <p className="font-bold text-foreground mt-0.5">ST-{entry.ticketAcceptance.ticketId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Job Order Created:</span>
                  <p className="font-bold text-foreground mt-0.5">
                    {entry.ticketAcceptance.jobOrderId ? `JO-${entry.ticketAcceptance.jobOrderId}` : 'None'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Field Changes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Field Changes & Values ({changes.length})
            </p>
            {changes.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground italic">No specific field diff recorded for this entry.</p>
            ) : (
              <div className="mt-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                {changes.map((c, idx) => (
                  <div
                    key={`${c.field}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-foreground text-xs sm:text-sm">{c.field}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {c.from !== 'None' && (
                        <>
                          <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive line-through max-w-[150px] truncate" title={c.from}>
                            {c.from}
                          </span>
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold max-w-[200px] truncate" title={c.to}>
                        {c.to}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Database Values Accordion */}
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <FileText size={13} /> View Raw Database Values (JSON)
              </span>
              {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showRaw && (
              <div className="mt-2 space-y-2 text-xs">
                {entry.oldValues && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Old Values:</span>
                    <pre className="mt-1 p-2 rounded bg-muted/50 border border-border overflow-x-auto text-[11px] font-mono">
                      {entry.oldValues}
                    </pre>
                  </div>
                )}
                {entry.newValues && (
                  <div>
                    <span className="font-semibold text-muted-foreground">New Values:</span>
                    <pre className="mt-1 p-2 rounded bg-muted/50 border border-border overflow-x-auto text-[11px] font-mono">
                      {entry.newValues}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border px-6 py-3 flex justify-end bg-accent/20">
          <button
            onClick={onClose}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}