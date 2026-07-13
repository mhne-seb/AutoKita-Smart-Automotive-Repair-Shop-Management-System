// jobOrderController

import { jobOrders } from '@/data/jobOrders'
import type { JobOrderCard, Stage } from '@/data/types'
import { stageOrder } from '@/data/types'
import { initialServices, initialParts, SERVICE_PRESETS, type ServiceLine, type PartLine } from '@/data/jobOrderWorkOrder'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/** Returns every job order currently on record (optionally filtered by customer). */
export async function getJobOrders(customerId?: string): Promise<JobOrderCard[]> {
  const data = customerId ? jobOrders.filter((j) => j.customerId === customerId) : jobOrders
  return simulateDelay(data)
}

/** Looks up a single job order by its id, or null if it doesn't exist. */
export async function getJobOrderById(id: string): Promise<JobOrderCard | null> {
  return simulateDelay(jobOrders.find((j) => j.id === id) ?? null)
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
