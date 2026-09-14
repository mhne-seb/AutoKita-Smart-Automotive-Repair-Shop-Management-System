'use client'

import { toast } from 'sonner'
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
  Eye,
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
  UserCog,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ScanLine,
} from 'lucide-react'
import { DIAGNOSTIC_SCAN_FEE } from '@/data/diagnosticScan'
import { TopBar } from '@/components/TopBar'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { PROVINCES, SERVICE_CATEGORIES, YEARS } from '@/data/ticketFormOptions'

export type JobStatus = 'Pending' | 'In Progress' | 'Approved' | 'Cancelled' | 'Completed'

export interface Job {
  ticketId: number
  customerId: string
  name: string
  phone: string
  email: string
  vehicle: string
  plate: string
  serviceMode: string
  status: JobStatus
  date: string
  servicesNeeded: string[]
  assignedMechanic?: string
  total?: number
  // Customer agreed to the OBD-II scan fee at booking — the mechanic may scan,
  // and the fee attaches to the job order on approval.
  diagnosticScanAuthorized: boolean
}

type Tab = 'All Jobs' | 'Pending' | 'Approved' | 'Cancelled'

const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const validPhone = (v: string) => /^(09\d{9}|\+639\d{9})$/.test(v.replace(/\s|-/g, ''))

// The raw `customer_concern` string sometimes carries extra notes tacked on
// by the customer, e.g. "Category: General Repair. Notes: helppp" or
// "Requested: Sep 11, 2026 09:30 AM | Service: Oil Change | asdf". For the
// table's "Service Needed" column we only want the actual service — the
// notes are still visible in full in the View modal.
const getServiceLabel = (raw: string): string => {
  if (!raw) return 'N/A'
  const serviceMatch = raw.match(/Service:\s*([^|]+)/i)
  if (serviceMatch) return serviceMatch[1].trim()
  const categoryMatch = raw.match(/Category:\s*([^.]+)/i)
  if (categoryMatch) return categoryMatch[1].trim()
  return raw.trim()
}

export default function page() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [mechanics, setMechanics] = useState<any[]>([])

  const fetchJobs = () => {
    fetch('/api/admin/job-queue')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const mappedJobs = data.tickets.map((t: any) => {
            let status: JobStatus = 'Pending'
            if (t.ticket_status === 'approved') status = 'Approved'
            if (t.ticket_status === 'declined' || t.ticket_status === 'cancelled') status = 'Cancelled'
            return {
              ticketId: t.ticket_id,
              customerId: `CUST-${t.user_id}`,
              name: `${t.first_name} ${t.last_name}`,
              phone: t.contact_number,
              email: t.email,
              vehicle: `${t.vehicle_model} ${t.vehicle_year}`,
              plate: t.plate_number,
              serviceMode: t.service_mode === 'walk_in' ? 'Shop Visit' : 'Home Service',
              servicesNeeded: [t.customer_concern || 'N/A'],
              diagnosticScanAuthorized: Boolean(t.diagnostic_scan_authorized),
              assignedMechanic: t.mechanic_id ? t.mechanic_id.toString() : undefined,
              status,
              date: new Date(t.request_date).toLocaleDateString(),
            }
          })
          setJobs(mappedJobs)
          setMechanics(data.mechanics || [])
        }
      })
      .catch(console.error)
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const [tab, setTab] = useState<Tab>('All Jobs')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 9

  const [showNewTicket, setShowNewTicket] = useState(false)
  const [approveTarget, setApproveTarget] = useState<Job | null>(null)
  const [viewTarget, setViewTarget] = useState<Job | null>(null)
  const [approving, setApproving] = useState(false)
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
    const q = searchQuery.trim().toLowerCase()

    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.customerId.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.vehicle.toLowerCase().includes(q) ||
      c.plate.toLowerCase().includes(q) ||
      c.serviceMode.toLowerCase().includes(q) ||
      c.servicesNeeded.some((service) =>
        service.toLowerCase().includes(q)
      )

    const matchesTab =
      tab === 'All Jobs' ||
      (tab === 'Pending' && c.status === 'Pending') ||
      (tab === 'Approved' &&
        (c.status === 'Approved' || c.status === 'In Progress')) ||
      (tab === 'Cancelled' && c.status === 'Cancelled')

    return matchesSearch && matchesTab
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedJobs = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const tabs: { label: Tab; count: number; icon: typeof Wrench }[] = [
    { label: 'All Jobs', count: counts.all, icon: Wrench },
    { label: 'Pending', count: counts.pending, icon: ShieldAlert },
    { label: 'Approved', count: counts.approved, icon: Package },
    { label: 'Cancelled', count: counts.cancelled, icon: XCircle },
  ]

  const updateMechanic = (ticketId: number, mechanic: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.ticketId === ticketId ? { ...j, assignedMechanic: mechanic === 'Unassigned' ? undefined : mechanic } : j)),
    )
  }

  const confirmApprove = async (job: Job) => {
    if (approving) return;
    if (!job.assignedMechanic || job.assignedMechanic === 'Unassigned') {
      alert("Please assign a mechanic first");
      return;
    }
    setApproving(true);
    try{
    await fetch('/api/admin/job-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', ticketId: job.ticketId, mechanicId: job.assignedMechanic })
    });
    setApproveTarget(null);
    fetchJobs();
  } finally {
    setApproving(false);
  }
  }

  const confirmReject = async (job: Job) => {
    await fetch('/api/admin/job-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', ticketId: job.ticketId })
    });
    setRejectTarget(null);
    fetchJobs();
  }

  const confirmDelete = async (job: Job) => {
    await fetch('/api/admin/job-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', ticketId: job.ticketId }) // treat delete as reject for now
    });
    setDeleteTarget(null);
    fetchJobs();
  }

  const addTicket = async (data: NewTicketData) => {
    try {
      const res = await fetch('/api/admin/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketData: data })
      });

      const result = await res.json();

      if (result.success) {
        setShowNewTicket(false);
        fetchJobs();
        toast.success('Ticket created');
      } else {
        // Technical detail stays in the console for us; the user gets plain English.
        console.error('Create ticket failed:', result.debug || result.message);
        toast.error('Could not create the ticket. Please check the details and try again.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <div className="space-y-6 p-8">
      <TopBar
        title="Job Queueing"
        subtitle="Intake of customer service tickets — shop visits, home service, walk-ins."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        rightSlot={
          <button
            onClick={() => setShowNewTicket(true)}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90"
          >
            <Plus size={15} /> New Ticket
          </button>
        }
      />

      <div className="flex flex-wrap gap-5">
        <StatCard label="Total Tickets" value={`${counts.all} Tickets`} icon={Wrench} iconBg="bg-gradient-to-br from-brand/20 to-brand/5" iconColor="text-brand" />
        <StatCard label="Waiting Approval" value={`${counts.pending} Pending`} icon={ShieldAlert} iconBg="bg-gradient-to-br from-violet-100 to-violet-50" iconColor="text-violet-600" />
        <StatCard label="Approved Service" value={`${counts.approved} Approved`} icon={Package} iconBg="bg-gradient-to-br from-amber-100 to-amber-50" iconColor="text-amber-600" />
        <StatCard label="Cancelled Service" value={`${counts.cancelled} Cancelled`} icon={XCircle} iconBg="bg-gradient-to-br from-rose-100 to-rose-50" iconColor="text-rose-600" />
      </div>

      <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card p-1.5">
        {tabs.map(({ label, count, icon: Icon }) => (
          <button
            key={label}
            onClick={() => { setTab(label); setCurrentPage(1); }}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === label ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            <Icon size={14} />
            {label}
            <span
              className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${tab === label ? 'bg-white/20 text-brand-foreground' : 'bg-accent text-muted-foreground'
                }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {currentPage} of {totalPages} · {filtered.length} total service tickets
          </p>
          <div className="flex gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Job queue table — every new booking lands here for triage */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Vehicle</th>
              <th className="px-4 py-3 font-semibold">Mode</th>
              <th className="px-4 py-3 font-semibold">Service Needed</th>
              <th className="px-4 py-3 font-semibold">Mechanic</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedJobs.map((c) => {
              const approvedLike = c.status === 'Approved' || c.status === 'In Progress'
              const unassigned = !c.assignedMechanic || c.assignedMechanic === 'Unassigned'
              return (
                <tr key={c.ticketId} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Hash size={11} className="shrink-0" /> {c.customerId}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone size={11} className="shrink-0" /> {c.phone}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Car size={12} className="shrink-0 text-muted-foreground" /> {c.vehicle}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Hash size={11} className="shrink-0" /> {c.plate}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex w-fit items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {c.serviceMode === 'Shop Visit' ? <Store size={12} /> : <Home size={12} />}
                      {c.serviceMode}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-1.5 text-foreground/80">
                      <Wrench size={12} className="shrink-0 text-muted-foreground" />
                      {c.servicesNeeded.map(getServiceLabel).join(', ')}
                    </span>
                    {c.diagnosticScanAuthorized && (
                      <span
                        title={`Customer agreed to the PHP ${DIAGNOSTIC_SCAN_FEE.toLocaleString()} OBD-II scan fee at booking`}
                        className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                      >
                        <ScanLine size={11} /> OBD-II scan authorized
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative">
                      <UserCog className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <select
                        value={c.assignedMechanic ?? 'Unassigned'}
                        onChange={(e) => updateMechanic(c.ticketId, e.target.value)}
                        className={`w-full min-w-[150px] rounded-md border py-1 pl-8 pr-2 text-sm text-foreground ${unassigned ? 'border-amber-300 bg-amber-50' : 'border-border'
                          }`}
                      >
                        <option value="Unassigned">Unassigned</option>
                        {mechanics.map(m => (
                          <option key={m.id} value={m.id.toString()}>{m.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={c.status === 'In Progress' ? 'Approved' : c.status} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setViewTarget(c)}
                        title="View"
                        className="flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent"
                      >
                        <Eye size={14} />
                      </button>
                      {approvedLike ? (
                        <button
                          onClick={() => setDeleteTarget(c)}
                          title="Delete"
                          className="flex items-center justify-center rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setApproveTarget(c)}
                            title="Approve"
                            className="flex items-center justify-center rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] p-2 text-brand-foreground hover:opacity-90"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setRejectTarget(c)}
                            title="Reject"
                            className="flex items-center justify-center rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {paginatedJobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {showNewTicket && <NewTicketModal onClose={() => setShowNewTicket(false)} onSubmit={addTicket} />}

      {approveTarget && (
        <ApproveModal job={approveTarget} busy={approving} onClose={() => setApproveTarget(null)} onConfirm={() => confirmApprove(approveTarget)} />
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

      {viewTarget && (
        <ViewModal job={viewTarget} onClose={() => setViewTarget(null)} />
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

function ApproveModal({ job, busy, onClose, onConfirm }: { job: Job; busy: boolean; onClose: () => void; onConfirm: () => void }) {
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
          {job.diagnosticScanAuthorized && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Diagnostic scan</dt>
              <dd className="text-right font-medium text-amber-700">
                Authorized — PHP {DIAGNOSTIC_SCAN_FEE.toLocaleString()} attaches on approval
              </dd>
            </div>
          )}
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
            table, then try again.
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={unassigned || busy}
            className="rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Approving...' : 'Confirm Approval'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hold modal — requires a reason before putting a job on hold.
// ---------------------------------------------------------------------------

function ViewModal({ job, onClose }: { job: Job; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Booking Reference No. {job.ticketId}
            </p>
            <h3 className="mt-1 text-lg font-bold text-foreground">Customer Booking Record</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The following information was submitted by the customer at the time of booking.
        </p>

        <div className="mt-5 space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer Information
            </p>
            <dl className="mt-2 space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Hash size={12} /> Customer ID
                </dt>
                <dd className="font-medium text-foreground">{job.customerId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <User size={12} /> Full Name
                </dt>
                <dd className="font-medium text-foreground">{job.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone size={12} /> Contact Number
                </dt>
                <dd className="font-medium text-foreground">{job.phone}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail size={12} /> Email Address
                </dt>
                <dd className="font-medium text-foreground">{job.email}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vehicle &amp; Service Details
            </p>
            <dl className="mt-2 space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Car size={12} /> Vehicle
                </dt>
                <dd className="text-right font-medium text-foreground">{job.vehicle}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Hash size={12} /> Plate Number
                </dt>
                <dd className="font-medium text-foreground">{job.plate}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  {job.serviceMode === 'Shop Visit' ? <Store size={12} /> : <Home size={12} />} Service Mode
                </dt>
                <dd className="font-medium text-foreground">{job.serviceMode}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Wrench size={12} /> Service(s) Requested
                </dt>
                <dd className="text-right font-medium text-foreground">{job.servicesNeeded.join(', ')}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Booking Status
            </p>
            <dl className="mt-2 space-y-2 rounded-lg border border-border p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar size={12} /> Date of Request
                </dt>
                <dd className="font-medium text-foreground">{job.date}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCog size={12} /> Assigned Mechanic
                </dt>
                <dd className="font-medium text-foreground">{job.assignedMechanic ?? 'Not yet assigned'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Current Status</dt>
                <dd>
                  <StatusBadge status={job.status === 'In Progress' ? 'Approved' : job.status} />
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Close
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
    `w-full rounded-md border py-2 pl-9 pr-3 text-sm focus:outline-none ${errors[key] ? 'border-destructive' : 'border-border focus:border-brand'
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
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${form.pickupOption === 'Shop Visit'
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${form.pickupOption === 'Shop Visit' ? 'border-brand' : 'border-border'
                        }`}
                    >
                      {form.pickupOption === 'Shop Visit' && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <Store size={15} /> Shop Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => set('pickupOption', 'Home Service')}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${form.pickupOption === 'Home Service'
                      ? 'border-brand bg-brand/5 text-brand'
                      : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${form.pickupOption === 'Home Service' ? 'border-brand' : 'border-border'
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
            <button type="submit" className="rounded-lg bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm hover:opacity-90">
              Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}