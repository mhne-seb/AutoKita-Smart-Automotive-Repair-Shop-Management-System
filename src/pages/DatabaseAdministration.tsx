'use client'

import { useMemo, useState } from 'react'
import { ShieldCheck, Eye, Search, X, User, Calendar, Database, Hash } from 'lucide-react'
import { auditLog as initialAuditLog } from '@/controllers/databaseController'
import { FIELD_POOL } from '@/data/auditFieldPool'

function detailsFor(entry: (typeof initialAuditLog)[number]) {
  const seed = entry.id.length + entry.entityId.length
  return [FIELD_POOL[seed % FIELD_POOL.length], FIELD_POOL[(seed + 1) % FIELD_POOL.length]]
}

export function DatabaseAdministration() {
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('All Actions')
  const [entityFilter, setEntityFilter] = useState('All Entities')
  const [detailTarget, setDetailTarget] = useState<(typeof initialAuditLog)[number] | null>(null)

  const actions = useMemo(() => Array.from(new Set(initialAuditLog.map((e) => e.action))), [])
  const entityTypes = useMemo(() => Array.from(new Set(initialAuditLog.map((e) => e.entityType))), [])

  const filtered = initialAuditLog.filter((entry) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q ||
      entry.user.toLowerCase().includes(q) ||
      entry.employee.toLowerCase().includes(q) ||
      entry.entityId.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q)
    const matchesAction = actionFilter === 'All Actions' || entry.action === actionFilter
    const matchesEntity = entityFilter === 'All Entities' || entry.entityType === entityFilter
    return matchesSearch && matchesAction && matchesEntity
  })

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Database Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor changes in the database.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-brand pl-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">Database Administration</h3>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck size={15} /> Role-Based Access Protected
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by user, entity ID, or action..."
              className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground"
          >
            <option>All Actions</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground"
          >
            <option>All Entities</option>
            {entityTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <span className="ml-auto text-sm font-semibold text-muted-foreground">
            {filtered.length} of {initialAuditLog.length} entries
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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No log entries match your search or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60 last:border-0">
                    <td className="py-4 font-semibold text-muted-foreground">{entry.id}</td>
                    <td className="py-4">
                      <p className="font-semibold text-foreground">User: {entry.user}</p>
                      <p className="text-sm text-muted-foreground">Employee: {entry.employee}</p>
                    </td>
                    <td className="py-4 font-semibold text-foreground">{entry.action}</td>
                    <td className="py-4 text-muted-foreground">{entry.entityType}</td>
                    <td className="py-4 font-semibold text-foreground">{entry.entityId}</td>
                    <td className="py-4 text-muted-foreground">{entry.date}</td>
                    <td className="py-4 text-right">
                      <button
                        aria-label="View details"
                        onClick={() => setDetailTarget(entry)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
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

      {detailTarget && <LogDetailModal entry={detailTarget} onClose={() => setDetailTarget(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Log detail modal — shown when the eye icon is clicked.
// ---------------------------------------------------------------------------

function LogDetailModal({ entry, onClose }: { entry: (typeof initialAuditLog)[number]; onClose: () => void }) {
  const changes = detailsFor(entry)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-bold text-foreground">Log Entry {entry.id}</p>
            <p className="text-xs text-muted-foreground">Full record of this database change</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User size={12} /> Performed By
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.user}</p>
              <p className="text-xs text-muted-foreground">Employee: {entry.employee}</p>
            </div>
            <div className="rounded-lg bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar size={12} /> Date
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.date}</p>
            </div>
            <div className="rounded-lg bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database size={12} /> Entity Type
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.entityType}</p>
            </div>
            <div className="rounded-lg bg-accent/60 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash size={12} /> Entity ID
              </p>
              <p className="mt-1 font-semibold text-foreground">{entry.entityId}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action Performed</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{entry.action}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field Changes</p>
            <div className="mt-2 space-y-2">
              {changes.map((c) => (
                <div key={c.field} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{c.field}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="rounded bg-destructive/10 px-2 py-0.5 text-destructive line-through">{c.from}</span>
                    →
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">{c.to}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}