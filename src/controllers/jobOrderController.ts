// jobOrderController

import { jobOrders } from '@/data/jobOrders'
import type { JobOrderCard, Stage } from '@/data/types'
import { stageOrder } from '@/data/types'
import { initialServices, initialParts, SERVICE_PRESETS, type ServiceLine, type PartLine } from '@/data/jobOrderWorkOrder'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

// ---------------------------------------------------------------------------
// Real database-backed listing (used by the Job Orders board / JobOrders.tsx)
// ---------------------------------------------------------------------------

// Your DB has 7 status values, but the UI only understands 4 stages.
// This function maps one to the other.
function mapDbStatusToStage(dbStatus: string): Stage {
  switch (dbStatus) {
    case 'inspecting':
      return 'inspecting'
    case 'pending_customer_approval':
    case 'revision_pending':
      return 'quotation'
    case 'in_progress':
    case 'waiting_on_parts':
      return 'in-progress'
    case 'completed':
    case 'released':
      return 'completed'
    default:
      return 'inspecting'
  }
}

const currency = (value: number | null) =>
  `₱${(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`

const STAGE_STEP_NUMBER: Record<Stage, number> = {
  inspecting: 1,
  quotation: 2,
  'in-progress': 3,
  completed: 4,
}

// Converts one raw database row into the shape the JobOrders page expects.
function toJobOrderCard(row: any): JobOrderCard {
  const stage = mapDbStatusToStage(row.status)

  return {
    id: String(row.id),
    customer: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.nickname || 'Unknown Customer',
    vehicle: row.vehicle_model ? `${row.vehicle_year ?? ''} ${row.vehicle_model}`.trim() : 'Unknown Vehicle',
    customerId: `CUST-${row.user_id ?? '0000'}`,
    stage,
    service: row.service_names || 'No services listed',
    time: row.date_arrived
      ? new Date(row.date_arrived).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—',
    plate: row.plate_number || '—',
    payment: currency(row.grand_total),
    paid: row.balance !== null && Number(row.balance) <= 0,
    mechanic: 'Unassigned', // no mechanic-assignment table exists in the schema yet
    stepsDone: STAGE_STEP_NUMBER[stage],
    stepsTotal: 4,
  }
}

export interface PaginatedJobOrders {
  data: JobOrderCard[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Fetches one page of job orders from the real database via the API route. */
export async function getJobOrders(page = 1, pageSize = 12): Promise<PaginatedJobOrders> {
  const res = await fetch(`/api/job-orders?page=${page}&pageSize=${pageSize}`)
  const json = await res.json()

  if (!json.success) {
    throw new Error(json.message || 'Failed to load job orders')
  }

  return {
    data: json.data.map(toJobOrderCard),
    total: json.total,
    page: json.page,
    pageSize: json.pageSize,
    totalPages: json.totalPages,
  }
}

// ---------------------------------------------------------------------------
// Everything below still reads from the mock data file (src/data/jobOrders.ts)
// — not yet wired to the real database. This is why clicking "View Full Job
// Order" on a real database job order currently shows "Job order not found":
// these lookups only know about the 5 fake ids (i1–i5). Wiring these to the
// database is the next step.
// ---------------------------------------------------------------------------

/** Looks up a single job order by its id from the real database, or null if it doesn't exist. */
export async function getJobOrderById(id: string): Promise<JobOrderCard | null> {
  const res = await fetch(`/api/job-orders/${id}`)

  if (res.status === 404) return null

  const json = await res.json()
  if (!json.success) return null

  return toJobOrderCard(json.data)
}

/**
 * Returns the most relevant job order for a given customer to show on their
 * dashboard: prefers an order that isn't finished yet, falling back to their
 * most recent completed one. Used by the Customer dashboard to show live
 * status that reflects whatever the Admin side has done.
 */
export async function getMyActiveJobOrder(customerId: string): Promise<JobOrderCard | null> {
  const mine = jobOrders.filter((j) => j.customerId === customerId)
  const active = mine.find((j) => j.stage !== 'completed')
  return simulateDelay(active ?? mine[0] ?? null)
}

/** Counts job orders grouped by stage — handy for dashboard summary cards. */
export async function getJobOrderStageCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const j of jobOrders) counts[j.stage] = (counts[j.stage] ?? 0) + 1
  return simulateDelay(counts)
}

/**
 * Moves a job order to a new stage. This is the write operation Admin pages
 * call when they inspect/quote/complete a vehicle — it's what makes the
 * Customer's tracking pages show up-to-date progress in this demo.
 */
export async function advanceJobOrderStage(id: string, stage: Stage): Promise<JobOrderCard | null> {
  const job = jobOrders.find((j) => j.id === id)
  if (!job) return simulateDelay(null)
  job.stage = stage
  // step-progress indicator roughly in sync with the stage
  const idx = stageOrder.indexOf(stage)
  job.stepsDone = Math.min(job.stepsTotal, idx + 1)
  return simulateDelay(job)
}

/** Assigns (or reassigns) the mechanic responsible for a job order. */
export async function assignMechanicToJobOrder(id: string, mechanicName: string): Promise<JobOrderCard | null> {
  const job = jobOrders.find((j) => j.id === id)
  if (!job) return simulateDelay(null)
  job.mechanic = mechanicName
  return simulateDelay(job)
}

/**
 * Returns the starting service/parts line items for the work-order builder
 * on the Job Order Detail page, plus the quick-add service presets.
 */
export async function getWorkOrderTemplate(): Promise<{
  services: ServiceLine[]
  parts: PartLine[]
  servicePresets: string[]
}> {
  return simulateDelay({ services: initialServices, parts: initialParts, servicePresets: SERVICE_PRESETS })
}