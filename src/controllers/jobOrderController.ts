// jobOrderController

import type { JobOrderCard, Stage, PaymentStatus } from '@/data/types'
import { stageOrder } from '@/data/types'

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
    case 'testing':
      return 'testing'
    case 'completed':
      return 'completed'
    case 'released':
    // Terminal, nothing left to do — sits with the finished ones. The card's
    // `cancelled` flag keeps the label honest.
    case 'cancelled':
      return 'released'
    default:
      return 'inspecting'
  }
}

const currency = (value: number | string | null) =>
  `₱${Number(value ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`

const STAGE_STEP_NUMBER: Record<Stage, number> = {
  inspecting: 1,
  quotation: 2,
  'in-progress': 3,
  testing: 4,
  completed: 5,
  released: 6,
}

// Converts one raw database row into the shape the JobOrders page expects.
function toJobOrderCard(row: any): JobOrderCard {
  const stage = mapDbStatusToStage(row.status)
  const grandTotal = Number(row.actual_grand_total ?? 0)
  const balance = row.balance !== null ? Number(row.balance) : null

  // Payment status logic:
  // When a job order starts (inspecting or quotation), payment starts as 'Pending'.
  // Once quotation has finished and the job order is in "in progress phase", it is regarded as 'Unpaid'.
  // Once paid/released or balance <= 0, it is regarded as 'Paid'.
  let paymentStatus: PaymentStatus = 'Pending'
  let paid = false

  if (row.status === 'cancelled') {
    paymentStatus = balance !== null && balance <= 0 && grandTotal > 0 ? 'Paid' : 'Pending'
    paid = paymentStatus === 'Paid'
  } else if (stage === 'inspecting' || stage === 'quotation') {
    paymentStatus = 'Pending'
    paid = false
  } else if (stage === 'released') {
    paymentStatus = 'Paid'
    paid = true
  } else {
    // 'in-progress', 'testing', 'completed'
    if (balance !== null && balance <= 0 && grandTotal > 0) {
      paymentStatus = 'Paid'
      paid = true
    } else {
      paymentStatus = 'Unpaid'
      paid = false
    }
  }

  return {
    id: String(row.id),
    customer: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.nickname || 'Unknown Customer',
    vehicle: row.vehicle_model ? `${row.vehicle_year ?? ''} ${row.vehicle_model}`.trim() : 'Unknown Vehicle',
    customerId: `CUST-${row.user_id ?? '0000'}`,
    stage,
    cancelled: row.status === 'cancelled',
    service: row.service_names || 'No services listed',
    time: row.date_arrived
      ? new Date(row.date_arrived).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—',
    plate: row.plate_number || '—',
    payment: currency(row.actual_grand_total),
    paid,
    paymentStatus,
    mechanic: row.mechanic_name || row.mechanic || 'Unassigned',
    stepsDone: STAGE_STEP_NUMBER[stage],
    stepsTotal: 6,
    mileage: row.mileage ? Number(row.mileage) : undefined,
    vehicleYear: row.vehicle_year ? Number(row.vehicle_year) : undefined,
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
// Real database-backed lookups and mutations
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
  try {
    const numericId = customerId.replace(/^CUST-/, '')
    const res = await fetch(`/api/job-orders?pageSize=100`)
    const json = await res.json()
    if (!json.success || !Array.isArray(json.data)) return null
    const cards = json.data.map(toJobOrderCard)
    const mine = cards.filter((j: JobOrderCard) => j.customerId === customerId || j.customerId === `CUST-${numericId}`)
    const active = mine.find((j: JobOrderCard) => j.stage !== 'completed' && j.stage !== 'released')
    return active ?? mine[0] ?? null
  } catch (err) {
    console.error('getMyActiveJobOrder error:', err)
    return null
  }
}

/** Counts job orders grouped by stage — handy for dashboard summary cards. */
export async function getJobOrderStageCounts(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/job-orders?pageSize=500')
    const json = await res.json()
    if (!json.success || !Array.isArray(json.data)) return {}
    const counts: Record<string, number> = {}
    for (const row of json.data) {
      const stage = mapDbStatusToStage(row.status)
      counts[stage] = (counts[stage] ?? 0) + 1
    }
    return counts
  } catch (err) {
    console.error('getJobOrderStageCounts error:', err)
    return {}
  }
}

/**
 * Moves a job order to a new stage — now a real write to the database via
 * advance_job_order_stage(), which also stamps timestamps and logs an audit
 * entry. This is what Admin pages call when they inspect/quote/complete a
 * vehicle; it's what makes the Customer's tracking pages show up-to-date,
 * persisted progress (survives a page refresh, unlike the old mock version).
 */
export async function advanceJobOrderStage(id: string, stage: Stage): Promise<JobOrderCard | null> {
  const res = await fetch(`/api/job-orders/${id}/advance-stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })

  const json = await res.json()
  if (!json.success) {
    console.error('Failed to advance job order stage:', json.message)
    return null
  }

  return toJobOrderCard(json.data)
}

/** Assigns (or reassigns) the mechanic responsible for a job order in Supabase. */
export async function assignMechanicToJobOrder(id: string, mechanicName: string): Promise<JobOrderCard | null> {
  try {
    const res = await fetch(`/api/job-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mechanicName }),
    })
    const json = await res.json()
    if (!json.success) {
      console.error('Failed to assign mechanic to job order:', json.message)
      return null
    }
    return toJobOrderCard(json.data)
  } catch (err) {
    console.error('assignMechanicToJobOrder error:', err)
    return null
  }
}