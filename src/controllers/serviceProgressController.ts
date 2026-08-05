// serviceProgressController — now backed by the real "service_progress_tasks"
// table instead of src/data/serviceProgress.ts.

import type { ServiceProgressData, ServiceSection, ServiceTask, TaskStatus } from '@/data/types'

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

  // Group raw rows by section
  const sectionMap = new Map<string, ServiceTask[]>()
  for (const row of rows) {
    const sectionId = SECTION_ID_MAP[row.section_id] ?? row.section_id
    const task: ServiceTask = {
      id: String(row.id),
      title: row.task_title,
      note: row.note ?? '',
      time: formatTaskTime(row.completed_at),
      status: mapDbTaskStatus(row.task_status),
      scheduledDate: row.scheduled_date ? new Date(row.scheduled_date).toISOString() : undefined,
      mechanicId: row.mechanic_id ?? undefined,
      mechanicName: row.mechanic_name ?? undefined,
      estimatedFinish: row.estimated_finish ? new Date(row.estimated_finish).toISOString() : undefined,
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

  return {
    jobOrderId,
    sections,
    quotationConfirmed,
  }
}

export async function getServiceProgressForJobOrder(jobOrderId: string): Promise<ServiceProgressData | null> {
  return (await getServiceProgressById(jobOrderId)) ?? null
}

export async function scheduleTask(jobOrderId: string, taskId: string, scheduledDate: string | null, status: string, mechanicId?: number, note?: string) {
  const dbStatus = status === 'active' ? 'in_progress' : status;
  const res = await fetch(`/api/job-orders/${jobOrderId}/progress/schedule`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ taskId, scheduledDate, status: dbStatus, mechanicId, note }),
  })
  return await res.json()
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
    preDiagnostic: { mechanic_notes: string | null; datetime_created: string | null } | null
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
  }>
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
  }>
}