'use client'

import { useEffect, useMemo, useState } from 'react'
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
  CalendarDays,
  CheckCircle2,
  BadgeCheck,
  MoreVertical,
  Pencil,
  Trash2,
  ImagePlus,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { getMechanics } from '@/controllers/mechanicController'
import type { Mechanic as BaseMechanic } from '../data/mockData'
import { EMPLOYMENT_TYPES, DAYS, AVATAR_PALETTE, CUSTOMER_POOL, type EmploymentType } from '@/data/mechanicsSeed'

type Mechanic = BaseMechanic & {
  employmentType: EmploymentType
  baseSalary: number
  commissionRate: number
  commissionEarned: number
  payrollStatus: 'Paid' | 'Pending'
  lastPayout: string
  schedule: { day: string; shift: string }[]
  photoUrl?: string
}

function seedSchedule(index: number) {
  const dayOff = (index * 2) % 7
  const morningShift = index % 2 === 0
  return DAYS.map((day, i) => ({
    day,
    shift: i === dayOff ? 'Day Off' : morningShift ? '8:00 AM – 5:00 PM' : '1:00 PM – 10:00 PM',
  }))
}

function seedPayroll(m: BaseMechanic, index: number): Mechanic {
  const employmentType = EMPLOYMENT_TYPES[index % EMPLOYMENT_TYPES.length]
  const baseSalary = employmentType === 'Full-Time' ? 18000 : employmentType === 'Part-Time' ? 11000 : 9000
  const commissionRate = 5 + (index % 4) * 2
  const commissionEarned = m.jobsAssigned * 850 + index * 120
  return {
    ...m,
    employmentType,
    baseSalary,
    commissionRate,
    commissionEarned,
    payrollStatus: index % 3 === 0 ? 'Pending' : 'Paid',
    lastPayout: index % 3 === 0 ? '—' : 'Jun 30, 2026',
    schedule: seedSchedule(index),
  }
}

const currency = (v: number) => `₱${v.toLocaleString()}`

// Fallback photo when no real one is uploaded — swap for a real photo field
function avatarUrl(m: Mechanic) {
  if (m.photoUrl) return m.photoUrl
  const hash = m.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const bg = AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=${bg}&color=fff&size=300&bold=true&font-size=0.38`
}
const SERVICE_HISTORY_POOL = [
  { service: 'Oil Change', vehicle: 'Toyota Vios 2021' },
  { service: 'Brake Service', vehicle: 'Honda Civic 2019' },
  { service: 'Engine Diagnostic', vehicle: 'Ford Ranger 2020' },
  { service: 'Tire Replacement', vehicle: 'Mitsubishi Montero 2022' },
  { service: 'Aircon Repair', vehicle: 'Nissan Terra 2021' },
]

function historyFor(m: Mechanic) {
  return Array.from({ length: 4 }).map((_, i) => {
    const entry = SERVICE_HISTORY_POOL[(m.id.length + i) % SERVICE_HISTORY_POOL.length]
    const customer = CUSTOMER_POOL[(m.id.length + i * 3) % CUSTOMER_POOL.length]
    return {
      id: `${m.id}-h${i}`,
      ...entry,
      customer,
      date: `Jun ${28 - i * 5}, 2026`,
      cost: 1800 + i * 650,
    }
  })
}

export function MechanicsManagement() {
  // Base mechanic records come through the controller (mock API); the
  // payroll/schedule fields are layered on top locally (see seedPayroll above).
  const [mechanicsList, setMechanicsList] = useState<Mechanic[]>([])

  useEffect(() => {
    let active = true
    getMechanics().then((data) => {
      if (active) setMechanicsList(data.map(seedPayroll))
    })
    return () => {
      active = false
    }
  }, [])

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All Types')
  const [statusFilter, setStatusFilter] = useState('All Statuses')

  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Mechanic | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Mechanic | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Mechanic | null>(null)
  const [profileTarget, setProfileTarget] = useState<Mechanic | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<Mechanic | null>(null)
  const [openCardMenu, setOpenCardMenu] = useState<string | null>(null)

  const statuses = useMemo(() => Array.from(new Set(mechanicsList.map((m) => m.status))), [mechanicsList])

  const filtered = mechanicsList.filter((m) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.branch.toLowerCase().includes(q)
    const matchesType = typeFilter === 'All Types' || m.employmentType === typeFilter
    const matchesStatus = statusFilter === 'All Statuses' || m.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const markPaid = (id: string) => {
    setMechanicsList((prev) =>
      prev.map((m) => (m.id === id ? { ...m, payrollStatus: 'Paid', lastPayout: 'Jul 5, 2026' } : m)),
    )
    setProfileTarget((prev) => (prev && prev.id === id ? { ...prev, payrollStatus: 'Paid', lastPayout: 'Jul 5, 2026' } : prev))
  }

  const addMechanic = (data: MechanicFormData) => {
    const id = `mech-${Date.now().toString().slice(-6)}`
    const newMechanic: Mechanic = {
      id,
      name: data.name,
      branch: data.branch,
      color: ['bg-brand', 'bg-emerald-500', 'bg-rose-500', 'bg-violet-500'][mechanicsList.length % 4],
      status: 'Available',
      email: data.email,
      phone: data.phone,
      location: data.location,
      jobsAssigned: 0,
      jobsCapacity: Number(data.jobsCapacity),
      employmentType: data.employmentType,
      baseSalary: Number(data.baseSalary),
      commissionRate: Number(data.commissionRate),
      commissionEarned: 0,
      payrollStatus: 'Pending',
      lastPayout: '—',
      schedule: data.schedule,
      photoUrl: data.photoUrl || undefined,
    } as unknown as Mechanic
    setMechanicsList((prev) => [newMechanic, ...prev])
    setShowAdd(false)
  }

  const saveEdit = (id: string, data: MechanicFormData) => {
    setMechanicsList((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              name: data.name,
              branch: data.branch,
              email: data.email,
              phone: data.phone,
              location: data.location,
              employmentType: data.employmentType,
              baseSalary: Number(data.baseSalary),
              commissionRate: Number(data.commissionRate),
              jobsCapacity: Number(data.jobsCapacity),
              schedule: data.schedule,
              photoUrl: data.photoUrl || undefined,
            }
          : m,
      ),
    )
    setEditTarget(null)
  }

  const deleteMechanic = (id: string) => {
    setMechanicsList((prev) => prev.filter((m) => m.id !== id))
    setDeleteTarget(null)
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
          className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          <Plus size={15} /> Add Mechanics
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm placeholder:text-muted-foreground focus:border-brand focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground"
        >
          <option>All Types</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm text-foreground"
        >
          <option>All Statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <Users size={15} /> {filtered.length} of {mechanicsList.length} Mechanics
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No mechanics match your search or filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const full = m.jobsAssigned === m.jobsCapacity
            return (
              <div key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setProfileTarget(m)} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
                      <img src={avatarUrl(m)} alt={m.name} className="h-full w-full object-cover" />
                    </button>
                    <div>
                      <p className="font-bold text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.employmentType}</p>
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
                        <div className="absolute right-0 top-9 z-10 w-36 rounded-lg border border-border bg-card p-1 text-left shadow-lg">
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
                            onClick={() => {
                              setOpenCardMenu(null)
                              setDeleteTarget(m)
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 size={14} /> {m.branch}
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
                      <MapPin size={14} /> {m.location}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Workload Capacity</span>
                      <span className={`font-semibold ${full ? 'text-destructive' : 'text-foreground'}`}>
                        {m.jobsAssigned}/{m.jobsCapacity} Jobs
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: m.jobsCapacity }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < m.jobsAssigned ? (full ? 'bg-destructive' : 'bg-emerald-500') : 'bg-accent'
                          }`}
                        />
                      ))}
                    </div>
                    {full && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle size={12} /> Fully booked
                      </p>
                    )}
                  </div>

                  <div className="my-4 h-px bg-border" />

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      onClick={() => setHistoryTarget(m)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                    >
                      <Clock3 size={14} /> Service History
                    </button>
                    <button
                      onClick={() => setScheduleTarget(m)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                    >
                      <CalendarDays size={14} /> Schedule
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

      {showAdd && <MechanicFormModal mode="add" onClose={() => setShowAdd(false)} onSubmit={addMechanic} />}
      {editTarget && (
        <MechanicFormModal
          mode="edit"
          initial={{
            name: editTarget.name,
            branch: editTarget.branch,
            email: editTarget.email,
            phone: editTarget.phone,
            location: editTarget.location,
            employmentType: editTarget.employmentType,
            baseSalary: String(editTarget.baseSalary),
            commissionRate: String(editTarget.commissionRate),
            jobsCapacity: String(editTarget.jobsCapacity),
            photoUrl: editTarget.photoUrl ?? '',
            schedule: editTarget.schedule,
          }}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => saveEdit(editTarget.id, data)}
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
              This will permanently remove this mechanic from the roster. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMechanic(deleteTarget.id)}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {historyTarget && <ServiceHistoryModal mechanic={historyTarget} onClose={() => setHistoryTarget(null)} />}
      {scheduleTarget && <ScheduleModal mechanic={scheduleTarget} onClose={() => setScheduleTarget(null)} />}
      {profileTarget && (
        <ProfileModal mechanic={profileTarget} onClose={() => setProfileTarget(null)} onMarkPaid={() => markPaid(profileTarget.id)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profile modal — contact + payroll/commission summary.
// ---------------------------------------------------------------------------

function ProfileModal({ mechanic, onClose, onMarkPaid }: { mechanic: Mechanic; onClose: () => void; onMarkPaid: () => void }) {
  const total = mechanic.baseSalary + mechanic.commissionEarned

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={avatarUrl(mechanic)} alt={mechanic.name} className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="font-bold text-foreground">{mechanic.name}</p>
              <p className="text-xs text-muted-foreground">
                {mechanic.employmentType} • {mechanic.branch}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payroll & Commission</p>
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
                <p className="mt-1 text-lg font-bold text-foreground">{mechanic.commissionRate}%</p>
              </div>
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Commission Earned</p>
                <p className="mt-1 text-lg font-bold text-foreground">{currency(mechanic.commissionEarned)}</p>
              </div>
              <div className="rounded-lg bg-accent/60 p-3">
                <p className="text-xs text-muted-foreground">Total This Period</p>
                <p className="mt-1 text-lg font-bold text-brand">{currency(total)}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CalendarClock size={14} /> Last Payout
              </p>
              <p className="text-xs text-muted-foreground">{mechanic.lastPayout}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mechanic.payrollStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {mechanic.payrollStatus}
            </span>
          </div>

          {mechanic.payrollStatus === 'Pending' && (
            <button
              onClick={onMarkPaid}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              <BadgeCheck size={15} /> Mark Payout as Paid
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service history modal
// ---------------------------------------------------------------------------

function ServiceHistoryModal({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const history = historyFor(mechanic)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-bold text-foreground">Service History — {mechanic.name}</p>
            <p className="text-xs text-muted-foreground">Most recent jobs completed</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto px-6 py-4">
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-foreground">{h.service}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.vehicle} • {h.date}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Customer: {h.customer}</p>
                </div>
                <p className="font-semibold text-foreground">{currency(h.cost)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly schedule modal
// ---------------------------------------------------------------------------

function ScheduleModal({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const today = DAYS[(new Date().getDay() + 6) % 7] // JS Sunday=0 → align to Monday-first DAYS array

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="font-bold text-foreground">Weekly Schedule — {mechanic.name}</p>
            <p className="text-xs text-muted-foreground">{mechanic.employmentType} shift rotation</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4">
          <ul className="divide-y divide-border">
            {mechanic.schedule.map((s) => (
              <li
                key={s.day}
                className={`flex items-center justify-between py-3 text-sm ${s.day === today ? 'font-semibold text-brand' : 'text-foreground'}`}
              >
                <span className="flex items-center gap-2">
                  {s.day === today && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                  {s.day}
                </span>
                <span className={s.shift === 'Day Off' ? 'text-muted-foreground' : ''}>{s.shift}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add / Edit mechanic modal (shared form)
// ---------------------------------------------------------------------------

type MechanicFormData = {
  name: string
  branch: string
  email: string
  phone: string
  location: string
  employmentType: EmploymentType
  baseSalary: string
  commissionRate: string
  jobsCapacity: string
  photoUrl: string
  schedule: { day: string; shift: string }[]
}

const defaultSchedule = () => DAYS.map((day) => ({ day, shift: day === 'Sunday' ? 'Day Off' : '8:00 AM – 5:00 PM' }))

const emptyMechanic = (): MechanicFormData => ({
  name: '',
  branch: 'AutoKita Main Branch',
  email: '',
  phone: '',
  location: '',
  employmentType: 'Full-Time',
  baseSalary: '',
  commissionRate: '',
  jobsCapacity: '5',
  photoUrl: '',
  schedule: defaultSchedule(),
})

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validPhone = (v: string) => /^(\+63\s?9\d{2}\s?\d{3}\s?\d{4}|09\d{9})$/.test(v.replace(/-/g, ''))

function MechanicFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  initial?: MechanicFormData
  onClose: () => void
  onSubmit: (data: MechanicFormData) => void
}) {
  const [form, setForm] = useState<MechanicFormData>(initial ?? emptyMechanic())
  const [errors, setErrors] = useState<Partial<Record<keyof MechanicFormData, string>>>({})

  const set = <K extends keyof MechanicFormData>(key: K, value: MechanicFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const setShift = (day: string, shift: string) => {
    setForm((prev) => ({ ...prev, schedule: prev.schedule.map((s) => (s.day === day ? { ...s, shift } : s)) }))
  }

  const handlePhoto = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => set('photoUrl', reader.result as string)
    reader.readAsDataURL(file)
  }

  const fieldClass = (key: keyof MechanicFormData) =>
    `mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
      errors[key] ? 'border-destructive' : 'border-border focus:border-brand'
    }`

  const ErrorText = ({ field }: { field: keyof MechanicFormData }) =>
    errors[field] ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
        <AlertCircle size={12} /> {errors[field]}
      </p>
    ) : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Partial<Record<keyof MechanicFormData, string>> = {}
    if (!form.name.trim()) next.name = 'Name is required'
    if (!form.branch.trim()) next.branch = 'Branch is required'
    if (!validEmail(form.email)) next.email = 'Enter a valid email address'
    if (!validPhone(form.phone)) next.phone = 'Enter a valid PH mobile number'
    if (!form.location.trim()) next.location = 'Location is required'
    if (!form.baseSalary || Number(form.baseSalary) <= 0) next.baseSalary = 'Enter a valid salary'
    if (!form.commissionRate || Number(form.commissionRate) < 0 || Number(form.commissionRate) > 100)
      next.commissionRate = 'Enter a rate between 0–100'
    if (!form.jobsCapacity || Number(form.jobsCapacity) <= 0) next.jobsCapacity = 'Enter a valid capacity'
    setErrors(next)
    if (Object.keys(next).length === 0) onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-lg font-bold text-foreground">{mode === 'add' ? 'Add Mechanic' : 'Edit Mechanic'}</p>
            <p className="text-sm text-muted-foreground">
              {mode === 'add' ? 'Add a new technician to the roster.' : 'Update this technician\u2019s details.'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Photo (2x2-style square) */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Photo</label>
            <div className="mt-1.5 flex items-center gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-accent">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImagePlus size={24} />
                  </div>
                )}
              </div>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
                  <ImagePlus size={14} /> Upload 2x2 Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="mt-1 text-xs text-muted-foreground">Square photo works best (e.g. 2x2 ID picture).</p>
              </div>
            </div>
          </div>

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
              <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Employment Type</label>
              <select
                value={form.employmentType}
                onChange={(e) => set('employmentType', e.target.value as EmploymentType)}
                className={fieldClass('employmentType')}
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
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
                value={form.commissionRate}
                onChange={(e) => set('commissionRate', e.target.value)}
                placeholder="e.g., 8"
                inputMode="numeric"
                className={fieldClass('commissionRate')}
              />
              <ErrorText field="commissionRate" />
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
            <ErrorText field="jobsCapacity" />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Weekly Schedule</label>
            <p className="mt-0.5 text-xs text-muted-foreground">Set the shift for each day, or mark it as a day off.</p>
            <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3">
              {form.schedule.map((s) => (
                <div key={s.day} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-sm text-foreground">{s.day}</span>
                  <input
                    value={s.shift === 'Day Off' ? '' : s.shift}
                    disabled={s.shift === 'Day Off'}
                    onChange={(e) => setShift(s.day, e.target.value)}
                    placeholder="e.g., 8:00 AM – 5:00 PM"
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm focus:border-brand focus:outline-none disabled:bg-accent disabled:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShift(s.day, s.shift === 'Day Off' ? '8:00 AM – 5:00 PM' : 'Day Off')}
                    className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      s.shift === 'Day Off' ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    Day Off
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent">
              Cancel
            </button>
            <button type="submit" className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
              <CheckCircle2 size={15} /> {mode === 'add' ? 'Add Mechanic' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
