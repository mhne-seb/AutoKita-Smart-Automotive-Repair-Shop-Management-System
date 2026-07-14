'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Wrench,
  ShieldAlert,
  Package,
  XCircle,
  Plus,
  Home,
  Store,
  Trash2,
  Pause,
  Check,
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Calendar,
  SlidersHorizontal,
  Hash,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { StatCard } from '../components/StatCard'
import { StatusBadge } from '../components/StatusBadge'
import { getCustomers } from '@/controllers/customerController'
import type { Customer, JobStatus } from '../data/mockData'
import { PROVINCES, SERVICE_CATEGORIES, YEARS } from '@/data/ticketFormOptions'

type Tab = 'All Jobs' | 'Pending' | 'Approved' | 'Cancelled'
type Job = Customer & { holdReason?: string }

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validPhone = (v: string) => /^(09\d{9}|\+639\d{9})$/.test(v.replace(/\s|-/g, ''))

export function JobQueue() {
  // Seeded through the controller (mock API) instead of importing the data
  // file directly — see src/controllers/customerController.ts.
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    let active = true
    getCustomers().then((data) => {
      if (active) setJobs(data as Job[])
    })
    return () => {
      active = false
    }
  }, [])

  const [tab, setTab] = useState<Tab>('All Jobs')

  const [showNewTicket, setShowNewTicket] = useState(false)
  const [approveTarget, setApproveTarget] = useState<Job | null>(null)
  const [holdTarget, setHoldTarget] = useState<Job | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Job | null>(null)

  const counts = useMemo(
    () => ({
      all: jobs.length,
      pending: jobs.filter((c) => c.status === 'Pending').length,
      approved: jobs.filter((c) => c.status === 'Approved' || c.status === 'In Progress').length,
      cancelled: jobs.filter((c) => c.status === 'Cancelled').length,
    }),
    [jobs],
  )

  const filtered = jobs.filter((c) => {
    if (tab === 'All Jobs') return true
    if (tab === 'Pending') return c.status === 'Pending'
    if (tab === 'Approved') return c.status === 'Approved' || c.status === 'In Progress'
    if (tab === 'Cancelled') return c.status === 'Cancelled'
    return true
  })

  const tabs: { label: Tab; count: number }[] = [
    { label: 'All Jobs', count: counts.all },
    { label: 'Pending', count: counts.pending },
    { label: 'Approved', count: counts.approved },
    { label: 'Cancelled', count: counts.cancelled },
  ]

  const updateMechanic = (id: string, mechanic: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.customerId === id ? { ...j, assignedMechanic: mechanic === 'Unassigned' ? undefined : mechanic } : j)),
    )
  }

  const confirmApprove = (job: Job) => {
    if (!job.assignedMechanic || job.assignedMechanic === 'Unassigned') return
    setJobs((prev) =>
      prev.map((j) => (j.customerId === job.customerId ? { ...j, status: 'Approved' as JobStatus, holdReason: undefined } : j)),
    )
    setApproveTarget(null)
  }

  const confirmReject = (job: Job) => {
    setJobs((prev) => prev.map((j) => (j.customerId === job.customerId ? { ...j, status: 'Cancelled' as JobStatus } : j)))
    setRejectTarget(null)
  }

  const confirmHold = (job: Job, reason: string) => {
    setJobs((prev) => prev.map((j) => (j.customerId === job.customerId ? { ...j, holdReason: reason } : j)))
    setHoldTarget(null)
  }

  const confirmDelete = (job: Job) => {
    setJobs((prev) => prev.filter((j) => j.customerId !== job.customerId))
    setDeleteTarget(null)
  }

  const addTicket = (data: NewTicketData) => {
    const newJob: Job = {
      customerId: `CUST-${Date.now().toString().slice(-6)}`,
      name: data.fullName,
      phone: data.contactNumber,
      vehicle: `${data.vehicleModel} ${data.year}`,
      plate: data.licensePlate,
      serviceMode: data.pickupOption,
      servicesNeeded: [data.serviceCategory],
      assignedMechanic: undefined,
      status: 'Pending' as JobStatus,
      totalCost: 0,
      balanceDue: 0,
    } as unknown as Job
    setJobs((prev) => [newJob, ...prev])
    setShowNewTicket(false)
  }

  return (
    <div className="space-y-6 p-8">
      <TopBar
        title="Job Queueing"
        subtitle="Intake of customer service tickets — shop visits, home service, walk-ins."
        rightSlot={
          <button
            onClick={() => setShowNewTicket(true)}
            className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
          >
            <Plus size={15} /> New Ticket
          </button>
        }
      />

      <div className="flex flex-wrap gap-5">
        <StatCard label="Total Customers" value={`${counts.all} Customers`} icon={Wrench} iconBg="bg-brand/10" iconColor="text-brand" />
        <StatCard label="Waiting Approval" value={`${counts.pending} Pending`} icon={ShieldAlert} iconBg="bg-violet-50" iconColor="text-violet-600" />
        <StatCard label="Approved Service" value={`${counts.approved} Approved`} icon={Package} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard label="Cancelled Service" value={`${counts.cancelled} Cancelled`} icon={XCircle} iconBg="bg-rose-50" iconColor="text-rose-600" />
      </div>

      <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card p-1.5">
        {tabs.map(({ label, count }) => (
          <button
            key={label}
            onClick={() => setTab(label)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === label ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${
                tab === label ? 'bg-white/20 text-brand-foreground' : 'bg-accent text-muted-foreground'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c) => {
          const approvedLike = c.status === 'Approved' || c.status === 'In Progress'
          const unassigned = !c.assignedMechanic || c.assignedMechanic === 'Unassigned'
          return (
            <div
              key={c.customerId}
              className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{c.vehicle}</h3>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {c.plate}
                  </span>
                </div>
                <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {c.customerId}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {c.serviceMode === 'Shop Visit' ? <Store size={12} /> : <Home size={12} />}
                  {c.serviceMode}
                </span>
                <StatusBadge status={c.status === 'In Progress' ? 'Approved' : c.status} />
              </div>

              {c.holdReason && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <Pause size={13} className="mt-0.5 shrink-0" />
                  On hold: {c.holdReason}
                </div>
              )}

              <p className="mt-2 text-sm text-muted-foreground">
                {c.name} • {c.phone}
              </p>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service Needed</p>
                <ul className="mt-1.5 space-y-1.5">
                  {c.servicesNeeded.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm text-foreground/80">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-border" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="my-3 h-px bg-border" />

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-muted-foreground">
                  <Wrench size={14} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Mechanic</p>
                  <select
                    value={c.assignedMechanic ?? 'Unassigned'}
                    onChange={(e) => updateMechanic(c.customerId, e.target.value)}
                    className={`mt-0.5 w-full rounded-md border px-2 py-1 text-sm text-foreground ${
                      unassigned ? 'border-amber-300 bg-amber-50' : 'border-border'
                    }`}
                  >
                    <option>Unassigned</option>
                    <option>Jose S.</option>
                    <option>Anthony T.</option>
                    <option>Robert D.</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {approvedLike ? (
                  <>
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
                      <Check size={15} /> Approved
                    </button>
                    <button
                      onClick={() => setHoldTarget(c)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent"
                    >
                      <Pause size={14} /> Hold
                    </button>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      className="flex items-center justify-center rounded-lg border border-rose-200 px-3 text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setApproveTarget(c)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(c)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onSubmit={addTicket} />}

      {approveTarget && (
        <ApproveModal job={approveTarget} onClose={() => setApproveTarget(null)} onConfirm={() => confirmApprove(approveTarget)} />
      )}

      {rejectTarget && (
        <ConfirmModal
          tone="danger"
          title="Reject this ticket?"
          description={`${rejectTarget.name}'s job order for ${rejectTarget.vehicle} will be marked as cancelled.`}
          confirmLabel="Reject Ticket"
          onClose={() => setRejectTarget(null)}
          onConfirm={() => confirmReject(rejectTarget)}
        />
      )}

      {holdTarget && (
        <HoldModal job={holdTarget} onClose={() => setHoldTarget(null)} onConfirm={(reason) => confirmHold(holdTarget, reason)} />
      )}

      {deleteTarget && (
        <ConfirmModal
          tone="danger"
          title="Delete this job order?"
          description={`This will permanently remove ${deleteTarget.name}'s job order for ${deleteTarget.vehicle}. This action cannot be undone.`}
          confirmLabel="Delete"
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => confirmDelete(deleteTarget)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Approve modal — shows the job details and blocks approval until a
// mechanic is assigned.
// ---------------------------------------------------------------------------

function ApproveModal({ job, onClose, onConfirm }: { job: Job; onClose: () => void; onConfirm: () => void }) {
  const unassigned = !job.assignedMechanic || job.assignedMechanic === 'Unassigned'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
            <CheckCircle2 size={20} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h3 className="mt-4 text-lg font-bold text-foreground">Approve job order?</h3>
        <p className="mt-1 text-sm text-muted-foreground">Review the details before approving this ticket.</p>

        <dl className="mt-4 space-y-2 rounded-lg bg-accent/50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="font-medium text-foreground">{job.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="font-medium text-foreground">
              {job.vehicle} — {job.plate}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Services</dt>
            <dd className="text-right font-medium text-foreground">{job.servicesNeeded.join(', ')}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Assigned Mechanic</dt>
            <dd className={`font-medium ${unassigned ? 'text-amber-600' : 'text-foreground'}`}>
              {job.assignedMechanic ?? 'Unassigned'}
            </dd>
          </div>
        </dl>

        {unassigned && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            You must assign a mechanic to this job before it can be approved. Close this dialog and pick one from the
            card, then try again.
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={unassigned}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm Approval
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hold modal — requires a reason before putting a job on hold.
// ---------------------------------------------------------------------------

function HoldModal({ job, onClose, onConfirm }: { job: Job; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the hold.')
      return
    }
    setError('')
    onConfirm(reason.trim())
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Pause size={20} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h3 className="mt-4 text-lg font-bold text-foreground">Put job on hold</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {job.name}'s {job.vehicle} job order will be paused until resumed.
        </p>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason for hold *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g., Waiting for parts delivery"
            className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
              error ? 'border-destructive' : 'border-border focus:border-brand'
            }`}
          />
          {error && (
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button onClick={submit} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            Confirm Hold
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generic confirm modal — used for reject + delete.
// ---------------------------------------------------------------------------

function ConfirmModal({
  tone,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  tone: 'danger' | 'default'
  title: string
  description: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 size={20} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <h3 className="mt-4 text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// New Ticket modal — full intake form with validation.
// ---------------------------------------------------------------------------

type NewTicketData = {
  fullName: string
  contactNumber: string
  email: string
  province: string
  city: string
  barangay: string
  vehicleModel: string
  year: string
  transmission: string
  mileage: string
  licensePlate: string
  pickupOption: 'Shop Visit' | 'Home Service'
  serviceCategory: string
}

const emptyTicket: NewTicketData = {
  fullName: '',
  contactNumber: '',
  email: '',
  province: '',
  city: '',
  barangay: '',
  vehicleModel: '',
  year: '',
  transmission: '',
  mileage: '',
  licensePlate: '',
  pickupOption: 'Shop Visit',
  serviceCategory: '',
}

function NewTicketModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: NewTicketData) => void }) {
  const [form, setForm] = useState<NewTicketData>(emptyTicket)
  const [errors, setErrors] = useState<Partial<Record<keyof NewTicketData, string>>>({})

  const set = <K extends keyof NewTicketData>(key: K, value: NewTicketData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const validate = (): boolean => {
    const next: Partial<Record<keyof NewTicketData, string>> = {}
    if (!form.fullName.trim()) next.fullName = 'Full name is required'
    if (!validPhone(form.contactNumber)) next.contactNumber = 'Enter a valid PH mobile number'
    if (!validEmail(form.email)) next.email = 'Enter a valid email address'
    if (!form.province) next.province = 'Province is required'
    if (!form.city) next.city = 'City is required'
    if (!form.barangay) next.barangay = 'Barangay is required'
    if (!form.vehicleModel.trim()) next.vehicleModel = 'Vehicle model is required'
    if (!form.year) next.year = 'Year is required'
    if (!form.transmission) next.transmission = 'Transmission is required'
    if (!form.mileage.trim()) next.mileage = 'Mileage is required'
    if (!form.licensePlate.trim()) next.licensePlate = 'License plate is required'
    if (!form.serviceCategory) next.serviceCategory = 'Service category is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) onSubmit(form)
  }

  const fieldClass = (key: keyof NewTicketData) =>
    `w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none ${
      errors[key] ? 'border-destructive' : 'border-border focus:border-brand'
    }`

  const ErrorText = ({ field }: { field: keyof NewTicketData }) =>
    errors[field] ? (
      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
        <AlertCircle size={12} /> {errors[field]}
      </p>
    ) : null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">New Ticket</h2>
            <p className="text-sm text-muted-foreground">Fill out the customer and vehicle details.</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          {/* Customer Details */}
          <section>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <User size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Customer Details</h3>
                <p className="text-xs text-muted-foreground">Tell us how to reach you.</p>
              </div>
            </div>

            <div className="mt-3 space-y-4 rounded-lg border border-border p-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    placeholder="Enter name"
                    className={fieldClass('fullName')}
                  />
                </div>
                <ErrorText field="fullName" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Contact Number <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={form.contactNumber}
                      onChange={(e) => set('contactNumber', e.target.value)}
                      placeholder="e.g., 09951234567"
                      className={fieldClass('contactNumber')}
                    />
                  </div>
                  <ErrorText field="contactNumber" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="you@email.com"
                      className={fieldClass('email')}
                    />
                  </div>
                  <ErrorText field="email" />
                </div>
              </div>
            </div>
          </section>

          {/* Location Information */}
          <section>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <MapPin size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Location Information</h3>
                <p className="text-xs text-muted-foreground">Where should we serve you?</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Province <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.province}
                    onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value, city: '', barangay: '' }))}
                    className={`${fieldClass('province')} appearance-none`}
                  >
                    <option value="">Select province</option>
                    {Object.keys(PROVINCES).map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <ErrorText field="province" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  City <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.city}
                    disabled={!form.province}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value, barangay: '' }))}
                    className={`${fieldClass('city')} appearance-none disabled:bg-accent disabled:text-muted-foreground`}
                  >
                    <option value="">{form.province ? 'Select city' : 'Select province first'}</option>
                    {(PROVINCES[form.province] ?? []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <ErrorText field="city" />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Barangay <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.barangay}
                    disabled={!form.city}
                    onChange={(e) => set('barangay', e.target.value)}
                    className={`${fieldClass('barangay')} appearance-none disabled:bg-accent disabled:text-muted-foreground`}
                  >
                    <option value="">{form.city ? 'Select barangay' : 'Select city first'}</option>
                    <option>Barangay 1</option>
                    <option>Barangay 2</option>
                    <option>Barangay 3</option>
                  </select>
                </div>
                <ErrorText field="barangay" />
              </div>
            </div>
          </section>

          {/* Vehicle Details */}
          <section>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Car size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Vehicle Details</h3>
                <p className="text-xs text-muted-foreground">Help our team prepare the right tools.</p>
              </div>
            </div>

            <div className="mt-3 space-y-4 rounded-lg border border-border p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Vehicle Model <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Car className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={form.vehicleModel}
                      onChange={(e) => set('vehicleModel', e.target.value)}
                      placeholder="e.g., Toyota Camry 2022"
                      className={fieldClass('vehicleModel')}
                    />
                  </div>
                  <ErrorText field="vehicleModel" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Year <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={form.year}
                      onChange={(e) => set('year', e.target.value)}
                      className={`${fieldClass('year')} appearance-none`}
                    >
                      <option value="">Select year</option>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ErrorText field="year" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Transmission <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={form.transmission}
                      onChange={(e) => set('transmission', e.target.value)}
                      className={`${fieldClass('transmission')} appearance-none`}
                    >
                      <option value="">Select transmission</option>
                      <option>Manual</option>
                      <option>Automatic</option>
                      <option>CVT</option>
                    </select>
                  </div>
                  <ErrorText field="transmission" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                    Mileage <span className="text-destructive">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={form.mileage}
                      onChange={(e) => set('mileage', e.target.value)}
                      placeholder="e.g., 45,000 km"
                      className={fieldClass('mileage')}
                    />
                  </div>
                  <ErrorText field="mileage" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  License Plate <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={form.licensePlate}
                    onChange={(e) => set('licensePlate', e.target.value)}
                    placeholder="e.g., ABC-1234"
                    className={fieldClass('licensePlate')}
                  />
                </div>
                <ErrorText field="licensePlate" />
              </div>
            </div>
          </section>

          {/* Service Preferences */}
          <section>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Wrench size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Service Preferences</h3>
                <p className="text-xs text-muted-foreground">What do you need done?</p>
              </div>
            </div>

            <div className="mt-3 space-y-4 rounded-lg border border-border p-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">Pick Up Option</label>
                <div className="mt-1.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => set('pickupOption', 'Shop Visit')}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
                      form.pickupOption === 'Shop Visit'
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        form.pickupOption === 'Shop Visit' ? 'border-brand' : 'border-border'
                      }`}
                    >
                      {form.pickupOption === 'Shop Visit' && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <Store size={15} /> Shop Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => set('pickupOption', 'Home Service')}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${
                      form.pickupOption === 'Home Service'
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        form.pickupOption === 'Home Service' ? 'border-brand' : 'border-border'
                      }`}
                    >
                      {form.pickupOption === 'Home Service' && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <Home size={15} /> Home Service
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Service Category <span className="text-destructive">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Wrench className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    value={form.serviceCategory}
                    onChange={(e) => set('serviceCategory', e.target.value)}
                    className={`${fieldClass('serviceCategory')} appearance-none`}
                  >
                    <option value="">Select a service</option>
                    {SERVICE_CATEGORIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <ErrorText field="serviceCategory" />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
              Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
