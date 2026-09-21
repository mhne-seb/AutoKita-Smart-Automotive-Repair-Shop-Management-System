// serviceProgressController — backed by the real "service_progress_tasks" table.

import type { ServiceProgressData, ServiceSection, ServiceTask, TaskStatus, TaskPart, PartsPurchase, Supplier } from '@/data/types'

// UI section ids use a hyphen ('in-progress'), the database enum uses an
// underscore ('in_progress') — this bridges the two.
const SECTION_ID_MAP: Record<string, string> = {
  received: 'received',
  inspecting: 'inspecting',
  quotation: 'quotation',
  in_progress: 'in-progress',
  complete: 'complete',
}

const SECTION_TITLES: Record<string, string> = {
  received: 'Received',
  inspecting: 'Inspecting',
  quotation: 'Quotation',
  'in-progress': 'In Progress',
  complete: 'Complete',
}

// Keeps sections in a consistent left-to-right order regardless of what
// order rows come back from the database in.
const SECTION_ORDER = ['received', 'inspecting', 'quotation', 'in-progress', 'complete']

// The database only stores 'pending' | 'in_progress' | 'completed'.
// The UI expects 'pending' | 'active' | 'completed'.
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// job_orders.estimated_duration is a Postgres TIME like "02:30:00" — to decimal hours.
function timeToHours(time: string | null | undefined): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return Math.round((h + m / 60) * 10) / 10
}

function mapDbTaskStatus(dbStatus: string): TaskStatus {
  if (dbStatus === 'completed') return 'completed'
  if (dbStatus === 'in_progress') return 'active'
  return 'pending'
}

function formatTaskTime(completedAt: string | null): string {
  if (!completedAt) return '—'
  return new Date(completedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Fetches the service progress checklist for a job order from the real
 * database, grouped into the same section shape the UI expects.
 *
 * Note: dummy data assigns tasks to job orders randomly, so a given job
 * order may only have a few tasks total rather than a full checklist across
 * all 5 sections — that's expected with random seed data, not a bug.
 */
export async function getServiceProgressById(jobOrderId: string): Promise<ServiceProgressData | undefined> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/progress`)
  const json = await res.json()

  if (!json.success) return undefined

  const rows: any[] = json.data

  // Parts grouped by service name — tasks are matched to their service by
  // title (service_progress_tasks has no FK to job_order_services).
  const partsByService = new Map<string, TaskPart[]>()
  for (const r of (json.parts ?? []) as any[]) {
    const list = partsByService.get(r.service_name) ?? []
    list.push({
      id: r.id,
      name: r.description || 'Unnamed part',
      partNo: r.part_number || '—',
      qty: r.quantity ?? 1,
      status: r.status,
      purchaseOrderId: r.purchase_order_id ?? undefined,
      supplierName: r.supplier_name ?? undefined,
      purchasedOn: r.purchased_on ? formatDate(r.purchased_on) : undefined,
    })
    partsByService.set(r.service_name, list)
  }

  // Group raw rows by section
  const sectionMap = new Map<string, ServiceTask[]>()
  const seenTaskIds = new Set<string>()
  for (const row of rows) {
    const taskId = String(row.id)
    if (seenTaskIds.has(taskId)) continue // guard against JOIN fan-out in the progress query
    seenTaskIds.add(taskId)

    const sectionId = SECTION_ID_MAP[row.section_id] ?? row.section_id
    const task: ServiceTask = {
      id: taskId,
      title: row.task_title,
      note: row.note ?? '',
      time: formatTaskTime(row.completed_at),
      status: mapDbTaskStatus(row.task_status),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
      scheduledDate: row.scheduled_date ? new Date(row.scheduled_date).toISOString() : undefined,
      mechanicId: row.mechanic_id ?? undefined,
      mechanicName: row.mechanic_name ?? undefined,
      estimatedFinish: row.estimated_finish ? new Date(row.estimated_finish).toISOString() : undefined,
      photoUrl: row.completion_photo_url ?? undefined,
      parts: partsByService.get(row.task_title) ?? [],
    }
    if (!sectionMap.has(sectionId)) sectionMap.set(sectionId, [])
    sectionMap.get(sectionId)!.push(task)
  }

  // Build sections in a fixed order, skipping ones with no tasks at all so
  // the UI doesn't show empty headers for sections this job order has no data for.
  const sections: ServiceSection[] = SECTION_ORDER.filter((id) => sectionMap.has(id)).map((id) => ({
    id,
    title: SECTION_TITLES[id],
    tasks: sectionMap.get(id)!,
  }))

  const quotationTasks = sectionMap.get('quotation') ?? []
  const quotationConfirmed = quotationTasks.length > 0 && quotationTasks.every((t) => t.status === 'completed')

  const purchases: PartsPurchase[] = ((json.purchases ?? []) as any[]).map((p) => ({
    id: p.id,
    supplierName: p.supplier_name,
    purchasedOn: formatDate(p.purchased_on),
    totalCost: Number(p.total_supplier_cost ?? 0),
    partCount: p.part_count ?? 0,
  }))

  const timing = json.timing ?? {}
  return {
    jobOrderId,
    sections,
    quotationConfirmed,
    purchases,
    timer: {
      startedAtIso: timing.started_at ?? null,
      completedAtIso: timing.completed_at ?? null,
      startedAt: formatDateTime(timing.started_at),
      estimatedFinish: formatDateTime(timing.date_promised),
      estimatedDurationHours: timeToHours(timing.estimated_duration),
    },
  }
}

export async function getServiceProgressForJobOrder(jobOrderId: string): Promise<ServiceProgressData | null> {
  return (await getServiceProgressById(jobOrderId)) ?? null
}

/** Flips a part between to_order and received. Returns whether it saved. */
/** Finishes a task. The photo is mandatory — it's the proof the work was done. */
export async function finishTask(
  jobOrderId: string,
  taskId: string,
  photo: File,
): Promise<{ ok: boolean; message?: string; roadTestCreated?: boolean; jobCompleted?: boolean }> {
  const form = new FormData()
  form.set('file', photo)
  const res = await fetch(`/api/job-orders/${jobOrderId}/progress/tasks/${taskId}/finish`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not finish the task.' }
  return { ok: true, roadTestCreated: json.roadTestCreated, jobCompleted: json.jobCompleted }
}

export async function setPartStatus(jobOrderId: string, partId: number, status: 'received' | 'to_order'): Promise<boolean> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/parts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partId, status }),
  })
  const json = await res.json().catch(() => null)
  return Boolean(res.ok && json?.success)
}

export async function getSuppliers(): Promise<Supplier[]> {
  const res = await fetch('/api/suppliers')
  const json = await res.json().catch(() => null)
  return json?.success ? json.suppliers : []
}

/** Adds a supplier by name (or returns the existing one if the name is already there). */
export async function addSupplier(name: string): Promise<Supplier | null> {
  const res = await fetch('/api/suppliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const json = await res.json().catch(() => null)
  return res.ok && json?.success ? json.supplier : null
}

/**
 * Records where a batch of to-order parts was bought. Creates the purchase
 * record and marks every listed part received.
 */
export async function recordPartsPurchase(
  jobOrderId: string,
  supplierId: number,
  purchasedOn: string,
  parts: { partId: number; unitCost: number }[],
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplierId, purchasedOn, parts }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not save the purchase.' }
  return { ok: true }
}

export async function scheduleTask(
  jobOrderId: string,
  taskId: string,
  scheduledDate: string | null,
  status: string,
  mechanicId?: number,
  note?: string,
): Promise<{ ok: boolean; message?: string }> {
  const dbStatus = status === 'active' ? 'in_progress' : status
  const res = await fetch(`/api/job-orders/${jobOrderId}/progress/schedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, scheduledDate, status: dbStatus, mechanicId, note }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not save the schedule.' }
  return { ok: true }
}

export async function getReceivedData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/received?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      date_arrived: string
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      actual_grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    services: {
      id: number
      service_name: string
      description_of_work: string
      estimated_hours: number
      actual_amount: string
    }[]
    history: {
      jo_date: string
      service_name: string
      actual_grand_total: string
    }[]
    customerConcern: string | null
    // Walkaround photos taken at drop-off — the vehicle's documented arrival condition.
    walkaround: {
      id: number
      label: string
      note: string | null
      photo: string
      logged_date: string
    }[]
  }>
}

export async function getInspectingData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/inspecting?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      estimated_duration: string
      actual_duration: string
      actual_grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    preDiagnostic: { 
      mechanic_notes: string | null
      datetime_created: string | null
      approval_status: string| null
  } | null
    walkaround: {
      id: number
      label: string
      note: string | null
      photo: string
      logged_date: string
    }[]
    // One entry per round the shop sent, oldest first, with the customer's
    // answer attached once they've given one.
    reviewHistory: {
      id: number
      mechanic_notes: string | null
      status: 'pending' | 'approved' | 'disputed'
      sent_at: string
      customer_reason: string | null
      responded_at: string | null
    }[]
    // True only while the shop hasn't started (no photos, findings, or report).
    canCancel: boolean
    findings: {
      id: number
      name: string | null
      status: string | null
      photo: string | null
      findings_description: string
      logged_date: string
    }[]
    shop: { name: string; address: string } | null
  }>
}

/** Withdraws an accepted booking the shop hasn't started on. The server
 *  re-checks the "nothing started yet" rule; a 409 means work began. */
export async function cancelJobOrder(userId: number, jobOrderId: number) {
  const res = await fetch('/api/customer/job-orders/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, jobOrderId }),
  })
  return res.json() as Promise<{ success: boolean; message?: string }>
}

/** Customer approves or disputes the inspection findings. Approving is what
 *  advances the job order to the quotation stage. */
export async function respondToInspection(
  userId: number,
  jobOrderId: number,
  decision: 'approved' | 'disputed',
  reason?: string,
) {
  const res = await fetch('/api/tracking/inspecting/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, jobOrderId, decision, reason }),
  })
  return res.json() as Promise<{ success: boolean; message?: string; decision?: string }>
}

export async function getInProgressData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/in-progress?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      actual_grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    tasks: {
      id: number
      section_id: string
      task_title: string
      note: string
      task_status: string
      completed_at: string | null
      price: string
      billable: boolean
      scheduled_date?: string
    }[]
    timing: {
      started_at: string | null
      completed_at: string | null
      labor_hours_estimate: string | number | null
      estimated_finish: string | null
    } | null
  }>
}

// The customer's final bill, computed live on the server (see lib/jobOrderBill).
export interface CustomerBill {
  total: number
  paid: number
  balance: number
  latestPayment: {
    id: number
    payment_method: string
    payment_channel: string | null
    reference_number: string | null
    amount_paid: number
    payment_date: string
    verification_status: 'pending' | 'verified' | 'rejected' | 'refunded'
  } | null
}

/** Customer settles the remaining balance on a completed job. The server decides the amount. */
export async function submitBalancePayment(
  jobOrderId: number,
  userId: number,
  method: 'shop' | 'ewallet',
  proof?: { channelId: string; referenceNumber: string; file: File },
) {
  const form = new FormData()
  form.set('jobOrderId', String(jobOrderId))
  form.set('userId', String(userId))
  form.set('method', method)
  if (proof) {
    form.set('channel', proof.channelId)
    form.set('referenceNumber', proof.referenceNumber)
    form.set('file', proof.file)
  }
  const res = await fetch('/api/tracking/completed/payment', { method: 'POST', body: form })
  return res.json() as Promise<{ success?: boolean; paymentId?: number; amount?: number; error?: string }>
}

export async function getCompletedData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/completed?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      date_arrived: string
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      actual_grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    logs: { id: number; activity_description: string; log_time: string }[]
    warranties: {
      id: number
      coverage_description: string
      start_date: string
      expiration_date: string
      status: string
    }[]
    services: {
      id: number
      service_name: string
      description_of_work: string
      estimated_hours: number
      actual_hours: number
      actual_amount: string
    }[]
    parts: {
      id: number
      description: string
      quantity: number
      retail_unit_price: string
      total_retail_amount: string
    }[]
    bill: CustomerBill | null
  }>
}