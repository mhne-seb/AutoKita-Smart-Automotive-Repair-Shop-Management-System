'use client'

import { useEffect, useState } from 'react'
import {
  Search,
  Plus,
  Building2,
  Mail,
  Phone,
  MapPin,
  Clock3,
  Users,
  X,
  AlertCircle,
  Wallet,
  Percent,
  CalendarClock,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  UserMinus,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import {
  getMechanics,
  addMechanic,
  updateMechanic,
  removeMechanic,
  getMechanicHistory,
  type Mechanic,
  type MechanicInput,
  type MechanicHistoryRow,
} from '@/controllers/mechanicController'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'

const GRADIENT = 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]'
const STATUS_OPTIONS = ['All Statuses', 'Available', 'Busy', 'On Leave']

const currency = (v: number) => `₱${v.toLocaleString()}`

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// No photo column in employees — initials avatar, colour picked from the name.
const AVATAR_PALETTE = ['1e3a5f', '0f766e', 'b45309', '7c3aed', 'be123c', '15803d']
function avatarUrl(name: string) {
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const bg = AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=300&bold=true&font-size=0.38`
}

export default function page() {
  const [mechanicsList, setMechanicsList] = useState<Mechanic[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const data = await getMechanics()
    setMechanicsList(data)
    setLoading(false)
  }
  useEffect(() => {
    void refresh()
  }, [])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Statuses')

  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Mechanic | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Mechanic | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Mechanic | null>(null)
  const [profileTarget, setProfileTarget] = useState<Mechanic | null>(null)
  const [openCardMenu, setOpenCardMenu] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = mechanicsList.filter((m) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.branch.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'All Statuses' || m.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const toInput = (m: Mechanic): MechanicInput => ({
    name: m.name,
    email: m.email,
    phone: m.phone,
    branch: m.branch,
    location: m.location,
    rank: m.rank,
    baseSalary: m.baseSalary,
    commissionPercent: m.commissionPercent,
    jobsCapacity: m.jobsCapacity,
  })

  const handleAdd = async (data: MechanicInput) => {
    setBusy(true)
    const r = await addMechanic(data)
    setBusy(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(`${data.name} added to the roster.`)
    setShowAdd(false)
    void refresh()
  }

  const handleEdit = async (id: number, data: MechanicInput) => {
    setBusy(true)
    const r = await updateMechanic(id, data)
    setBusy(false)
    if (!r.ok) return toast.error(r.message)
    toast.success('Mechanic updated.')
    setEditTarget(null)
    void refresh()
  }

  // On-leave mechanics disappear from the assignment dropdown (the paper's
  // "not on leave" check) but keep their tasks and history.
  const toggleLeave = async (m: Mechanic) => {
    setOpenCardMenu(null)
    const next = m.employeeStatus === 'on_leave' ? 'active' : 'on_leave'
    const r = await updateMechanic(m.id, { ...toInput(m), status: next })
    if (!r.ok) return toast.error(r.message)
    toast.success(next === 'on_leave' ? `${m.name} marked on leave.` : `${m.name} is back on the floor.`)
    void refresh()
  }

  const handleDelete = async (m: Mechanic) => {
    setBusy(true)
    const r = await removeMechanic(m.id)
    setBusy(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(`${m.name} removed from the roster.`)
    setDeleteTarget(null)
    void refresh()
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mechanic Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage workshop resources and optimize service throughput.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className={`flex items-center gap-2 rounded-full ${GRADIENT} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95`}
        >
          <Plus size={15} /> Add Mechanic
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or branch..."
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users size={15} /> {filtered.length} of {mechanicsList.length} Mechanics
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-12 text-sm text-muted-foreground">
          <Loader2 size={16} className="mr-2 animate-spin" /> Loading mechanics...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {mechanicsList.length === 0 ? 'No mechanics on the roster yet. Add one to get started.' : 'No mechanics match your search or filters.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const full = m.openTasks >= m.jobsCapacity
            const onLeave = m.employeeStatus === 'on_leave'
            return (
              <div key={m.id} className={`overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-sm ${onLeave ? 'opacity-75' : ''}`}>
                <div className={`h-1 ${GRADIENT}`} />
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setProfileTarget(m)} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                        <img src={avatarUrl(m.name)} alt={m.name} className="h-full w-full object-cover" />
                      </button>
                      <div>
                        <p className="font-bold text-foreground">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.rank || 'Mechanic'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <div className="relative">
                        <button
                          onClick={() => setOpenCardMenu(openCardMenu === m.id ? null : m.id)}
                          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Mechanic options"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openCardMenu === m.id && (
                          <div className="absolute right-0 top-9 z-10 w-44 rounded-lg border border-border bg-card p-1 text-left shadow-lg">
                            <button
                              onClick={() => {
                                setOpenCardMenu(null)
                                setEditTarget(m)
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => toggleLeave(m)}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                            >
                              {onLeave ? <UserCheck size={14} /> : <UserMinus size={14} />}
                              {onLeave ? 'Mark Available' : 'Mark On Leave'}
                            </button>
                            <button
                              onClick={() => {
                                setOpenCardMenu(null)
                                setDeleteTarget(m)
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 size={14} /> {m.branch || 'No branch set'}
                  </p>

                  <div className="my-4 h-px bg-border" />

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Mail size={14} /> {m.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={14} /> {m.phone}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin size={14} /> {m.location || 'No location set'}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Open Tasks</span>
                      <span className={`font-semibold ${full ? 'text-destructive' : 'text-foreground'}`}>
                        {m.openTasks}/{m.jobsCapacity}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: m.jobsCapacity }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < m.openTasks ? (full ? 'bg-destructive' : 'bg-emerald-500') : 'bg-accent'
                          }`}
                        />
                      ))}
                    </div>
                    {full && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle size={12} /> At capacity — can't take new tasks
                      </p>
                    )}
                  </div>

                  <div className="my-4 h-px bg-border" />

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      onClick={() => setHistoryTarget(m)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                    >
                      <Clock3 size={14} /> Task History
                    </button>
                    <button
                      onClick={() => setProfileTarget(m)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                    >
                      <Wallet size={14} /> Payroll
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <MechanicFormModal mode="add" busy={busy} onClose={() => setShowAdd(false)} onSubmit={handleAdd} />}
      {editTarget && (
        <MechanicFormModal
          mode="edit"
          busy={busy}
          initial={toInput(editTarget)}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => handleEdit(editTarget.id, data)}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 size={20} />
              </div>
              <button onClick={() => setDeleteTarget(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <h3 className="mt-4 text-lg font-bold text-foreground">Remove {deleteTarget.name}?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              They'll be taken off the roster and can no longer be assigned. Their finished work and payroll records are kept.
            </p>
            {deleteTarget.openTasks > 0 && (
              <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} /> Still has {deleteTarget.openTasks} open task(s) — reassign them first.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={busy || deleteTarget.openTasks > 0}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && <TaskHistoryModal mechanic={historyTarget} onClose={() => setHistoryTarget(null)} />}
      {profileTarget && <ProfileModal mechanic={profileTarget} onClose={() => setProfileTarget(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile modal — pay setup + this month's commission + last payroll run.
// Read-only: payroll runs are generated from the Sales & Payroll page.
// ---------------------------------------------------------------------------

function ProfileModal({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const lp = mechanic.lastPayroll
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className={`flex items-center justify-between ${GRADIENT} px-6 py-4`}>
          <div className="flex items-center gap-3">
            <img src={avatarUrl(mechanic.name)} alt={mechanic.name} className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="font-bold text-white">{mechanic.name}</p>
              <p className="text-xs text-white/70">
                {mechanic.rank || 'Mechanic'} • Hired {fmtDate(mechanic.hireDate)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pay Setup</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet size={12} /> Base Salary
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{currency(mechanic.baseSalary)}</p>
              </div>
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Percent size={12} /> Commission Rate
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{mechanic.commissionPercent}%</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Month</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Tasks Finished</p>
                <p className="mt-1 text-lg font-bold text-foreground">{mechanic.completedThisMonth}</p>
              </div>
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Commission Earned</p>
                <p className="mt-1 text-lg font-bold text-brand">{currency(mechanic.commissionThisMonth)}</p>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Commission = total of finished task prices × rate.</p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CalendarClock size={14} /> Last Payroll Run
              </p>
              <p className="text-xs text-muted-foreground">
                {lp ? `${fmtDate(lp.periodStart)} – ${fmtDate(lp.periodEnd)} • ${currency(lp.netPay)}` : 'No payroll generated yet'}
              </p>
            </div>
            {lp && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                  lp.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {lp.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Task history modal — what this mechanic has actually worked on.
// ---------------------------------------------------------------------------

function TaskHistoryModal({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const [rows, setRows] = useState<MechanicHistoryRow[] | null>(null)
  useEffect(() => {
    getMechanicHistory(mechanic.id).then(setRows)
  }, [mechanic.id])

  const statusLabel = (s: string) => (s === 'completed' ? 'Finished' : s === 'in_progress' ? 'Started' : 'Not Yet')

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className={`flex items-center justify-between ${GRADIENT} px-6 py-4`}>
          <div>
            <p className="font-bold text-white">Task History — {mechanic.name}</p>
            <p className="text-xs text-white/70">Most recent tasks assigned to this mechanic</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-6 py-4">
          {rows === null ? (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tasks assigned yet.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{h.taskTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      JO-{h.jobOrderId} • {h.vehicle || 'Vehicle'} {h.plate && `(${h.plate})`} • {fmtDate(h.when)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Customer: {h.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">{currency(h.price)}</p>
                    <p className={`text-xs ${h.taskStatus === 'completed' ? 'text-emerald-600' : 'text-muted-foreground'}`}>{statusLabel(h.taskStatus)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit mechanic modal (shared form)
// ---------------------------------------------------------------------------

type FormState = {
  name: string
  email: string
  phone: string
  branch: string
  location: string
  rank: string
  baseSalary: string
  commissionPercent: string
  jobsCapacity: string
}

const emptyForm = (): FormState => ({
  name: '',
  email: '',
  phone: '',
  branch: 'AutoKita Main Branch',
  location: '',
  rank: 'Mechanic',
  baseSalary: '',
  commissionPercent: '',
  jobsCapacity: String(DEFAULT_MECHANIC_CAPACITY),
})

const fromInput = (m: MechanicInput): FormState => ({
  name: m.name,
  email: m.email,
  phone: m.phone,
  branch: m.branch,
  location: m.location,
  rank: m.rank,
  baseSalary: String(m.baseSalary || ''),
  commissionPercent: String(m.commissionPercent),
  jobsCapacity: String(m.jobsCapacity),
})

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validPhone = (v: string) => /^(\+63\s?9\d{2}\s?\d{3}\s?\d{4}|09\d{9})$/.test(v.replace(/-/g, ''))

function MechanicFormModal({
  mode,
  initial,
  busy,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  initial?: MechanicInput
  busy: boolean
  onClose: () => void
  onSubmit: (data: MechanicInput) => void
}) {
  const [form, setForm] = useState<FormState>(initial ? fromInput(initial) : emptyForm())
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const fieldClass = (key: keyof FormState) =>
    `mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
      errors[key] ? 'border-destructive' : 'border-border focus:border-brand'
    }`

  const ErrorText = ({ field }: { field: keyof FormState }) =>
    errors[field] ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
        <AlertCircle size={12} /> {errors[field]}
      </p>
    ) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (!validEmail(form.email)) next.email = 'Enter a valid email address'
    if (!validPhone(form.phone)) next.phone = 'Enter a valid PH mobile number'
    if (!form.branch.trim()) next.branch = 'Branch is required'
    if (!form.location.trim()) next.location = 'Location is required'
    if (!form.baseSalary || Number(form.baseSalary) <= 0) next.baseSalary = 'Enter a valid salary'
    if (form.commissionPercent === '' || Number(form.commissionPercent) < 0 || Number(form.commissionPercent) > 100)
      next.commissionPercent = 'Enter a rate between 0–100'
    if (!form.jobsCapacity || Number(form.jobsCapacity) <= 0) next.jobsCapacity = 'Enter a valid capacity'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit({
      name: form.name,
      email: form.email,
      phone: form.phone,
      branch: form.branch,
      location: form.location,
      rank: form.rank,
      baseSalary: Number(form.baseSalary),
      commissionPercent: Number(form.commissionPercent),
      jobsCapacity: Number(form.jobsCapacity),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background shadow-2xl">
        <div className={`flex items-center justify-between ${GRADIENT} px-6 py-4`}>
          <div>
            <p className="text-lg font-bold text-white">{mode === 'add' ? 'Add Mechanic' : 'Edit Mechanic'}</p>
            <p className="text-sm text-white/70">
              {mode === 'add' ? 'Add a new technician to the roster.' : 'Update this technician’s details.'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Full Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g., Mark Reyes" className={fieldClass('name')} />
            <ErrorText field="name" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Email *</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@autokita.com" className={fieldClass('email')} />
              <ErrorText field="email" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Phone *</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="09171234567" className={fieldClass('phone')} />
              <ErrorText field="phone" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Branch *</label>
              <input value={form.branch} onChange={(e) => set('branch', e.target.value)} className={fieldClass('branch')} />
              <ErrorText field="branch" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Location *</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Manila, Philippines" className={fieldClass('location')} />
              <ErrorText field="location" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Rank</label>
              <input value={form.rank} onChange={(e) => set('rank', e.target.value)} placeholder="e.g., Senior Mechanic" className={fieldClass('rank')} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Base Salary *</label>
              <input
                value={form.baseSalary}
                onChange={(e) => set('baseSalary', e.target.value)}
                placeholder="e.g., 15000"
                inputMode="numeric"
                className={fieldClass('baseSalary')}
              />
              <ErrorText field="baseSalary" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Commission % *</label>
              <input
                value={form.commissionPercent}
                onChange={(e) => set('commissionPercent', e.target.value)}
                placeholder="e.g., 8"
                inputMode="numeric"
                className={fieldClass('commissionPercent')}
              />
              <ErrorText field="commissionPercent" />
            </div>
          </div>

          <div className="sm:w-1/2">
            <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Job Capacity *</label>
            <input
              value={form.jobsCapacity}
              onChange={(e) => set('jobsCapacity', e.target.value)}
              inputMode="numeric"
              className={fieldClass('jobsCapacity')}
            />
            <p className="mt-1 text-xs text-muted-foreground">Max open tasks at once. The scheduler won't assign more than this.</p>
            <ErrorText field="jobsCapacity" />
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`flex items-center gap-2 rounded-lg ${GRADIENT} px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-60`}
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {mode === 'add' ? 'Add Mechanic' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
