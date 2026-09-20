// mechanicController — the admin Mechanics page's view of /api/admin/mechanics.
//
// A mechanic = employees row + employee_profiles row + a live workload count
// from service_progress_tasks (the same count the assignment cap uses).

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated'
export type MechanicStatus = 'Available' | 'Busy' | 'On Leave'

export interface Mechanic {
  id: number
  name: string
  email: string
  phone: string
  employeeStatus: EmployeeStatus
  hireDate: string | null
  branch: string
  location: string
  rank: string
  baseSalary: number
  commissionPercent: number
  jobsCapacity: number
  openTasks: number
  completedThisMonth: number
  // SUM(price of tasks finished this month) × commission %
  commissionThisMonth: number
  lastPayroll: { periodStart: string; periodEnd: string; netPay: number; status: string; paymentDate: string | null } | null
  // Derived for the badge: on_leave wins, then full vs. has room.
  status: MechanicStatus
}

export interface MechanicInput {
  name: string
  email: string
  phone: string
  branch: string
  location: string
  rank: string
  baseSalary: number
  commissionPercent: number
  jobsCapacity: number
  status?: 'active' | 'on_leave'
}

export interface MechanicHistoryRow {
  id: number
  taskTitle: string
  taskStatus: string
  price: number
  when: string | null
  jobOrderId: number
  vehicle: string
  plate: string
  customer: string
}

export interface MechanicAuditLog {
  id: number
  adminId: number
  adminName: string
  actionPerformed: string
  entityType: string
  entityId: number
  oldValues: string | null
  newValues: string | null
  actionDate: string
}

export interface MechanicsData {
  mechanics: Mechanic[]
  auditLogs: MechanicAuditLog[]
}

type Result = { ok: boolean; message?: string }

function toMechanic(r: Record<string, unknown>): Mechanic {
  const openTasks = Number(r.open_tasks ?? 0)
  const jobsCapacity = Number(r.jobs_capacity ?? 0)
  const commissionPercent = Number(r.commission_percent ?? 0)
  const billed = Number(r.billed_this_month ?? 0)
  const employeeStatus = r.status as EmployeeStatus
  const lp = r.last_payroll as Record<string, unknown> | null
  return {
    id: Number(r.id),
    name: String(r.full_name ?? ''),
    email: String(r.email ?? ''),
    phone: String(r.contact_number ?? ''),
    employeeStatus,
    hireDate: (r.hire_date as string) ?? null,
    branch: String(r.branch ?? ''),
    location: String(r.location ?? ''),
    rank: String(r.rank ?? ''),
    baseSalary: Number(r.base_salary ?? 0),
    commissionPercent,
    jobsCapacity,
    openTasks,
    completedThisMonth: Number(r.completed_this_month ?? 0),
    commissionThisMonth: Math.round(billed * commissionPercent) / 100,
    lastPayroll: lp
      ? {
          periodStart: String(lp.period_start),
          periodEnd: String(lp.period_end),
          netPay: Number(lp.net_pay ?? 0),
          status: String(lp.status ?? 'draft'),
          paymentDate: (lp.payment_date as string) ?? null,
        }
      : null,
    status: employeeStatus === 'on_leave' ? 'On Leave' : openTasks >= jobsCapacity ? 'Busy' : 'Available',
  }
}

function getActingAdminId(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = sessionStorage.getItem('autokita_user_id')
  if (!raw) return undefined
  const parsed = parseInt(raw, 10)
  return isNaN(parsed) ? undefined : parsed
}

export async function getMechanicsData(): Promise<MechanicsData> {
  const res = await fetch('/api/admin/mechanics', { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { mechanics: [], auditLogs: [] }
  return {
    mechanics: ((json.mechanics as Record<string, unknown>[]) || []).map(toMechanic),
    auditLogs: (json.auditLogs as MechanicAuditLog[]) || [],
  }
}

export async function getMechanics(): Promise<Mechanic[]> {
  const data = await getMechanicsData()
  return data.mechanics
}

async function send(method: 'POST' | 'PATCH', body: Record<string, unknown>): Promise<Result> {
  const adminId = getActingAdminId()
  const payload = adminId ? { ...body, adminId } : body
  const res = await fetch('/api/admin/mechanics', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Request failed.' }
  return { ok: true }
}

export function addMechanic(input: MechanicInput): Promise<Result> {
  return send('POST', input as unknown as Record<string, unknown>)
}

export function updateMechanic(id: number, input: MechanicInput): Promise<Result> {
  return send('PATCH', { id, ...input })
}

// Soft delete — the API refuses while the mechanic still holds open tasks.
export async function removeMechanic(id: number): Promise<Result> {
  const adminId = getActingAdminId()
  const query = adminId ? `?id=${id}&adminId=${adminId}` : `?id=${id}`
  const res = await fetch(`/api/admin/mechanics${query}`, { method: 'DELETE' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not remove mechanic.' }
  return { ok: true }
}

export async function getMechanicHistory(id: number): Promise<MechanicHistoryRow[]> {
  const res = await fetch(`/api/admin/mechanics/${id}/history`, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return []
  return (json.history as Record<string, unknown>[]).map((h) => ({
    id: Number(h.id),
    taskTitle: String(h.task_title ?? ''),
    taskStatus: String(h.task_status ?? 'pending'),
    price: Number(h.price ?? 0),
    when: (h.completed_at as string) ?? (h.scheduled_date as string) ?? null,
    jobOrderId: Number(h.job_order_id),
    vehicle: [h.vehicle_year, h.vehicle_make, h.vehicle_model].filter(Boolean).join(' '),
    plate: String(h.plate_number ?? ''),
    customer: [h.first_name, h.last_name].filter(Boolean).join(' ') || 'Customer',
  }))
}
