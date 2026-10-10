// Where a customer's job order is shown while it is still open.
// One place for the status -> stage rule, so the dashboard and My Vehicles agree.

export const STATUS_TO_STEP: Record<string, number> = {
  inspecting: 1,
  pending_customer_approval: 2,
  revision_pending: 2,
  waiting_on_parts: 3,
  in_progress: 3,
  testing: 4,
  completed: 5,
  released: 6,
  cancelled: 6,
}

// Same order as the tracking pages under /dashboard/tracking/.
export const TRACKING_STAGES = ['received', 'inspecting', 'quotation', 'in-progress', 'testing', 'billing', 'completed'] as const

// A job is finished for the customer once the car went home or the job was cancelled.
export const FINISHED_STATUSES = new Set(['released', 'cancelled'])

export function trackingHref(status: string, jobOrderId: number): string {
  const stage = TRACKING_STAGES[STATUS_TO_STEP[status] ?? 0] ?? 'received'
  return `/dashboard/tracking/${stage}?jobOrderId=${jobOrderId}`
}
