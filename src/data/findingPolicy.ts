
export const FINDING_REMINDER_MINUTES = 30
export const FINDING_ADMIN_FLAG_HOURS = 2
export const FINDING_TIMEOUT_HOURS = 4

export const SUSPENDED_LABEL = 'Suspended. Awaiting Client Approval'

/** Hours since the finding was sent, to one decimal. */
export function findingAgeHours(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.round(((now - new Date(createdAt).getTime()) / 36e5) * 10) / 10)
}

/** True once the finding has waited the full policy window with no answer. */
export function findingIsOverdue(createdAt: string, now: number = Date.now()): boolean {
  return findingAgeHours(createdAt, now) >= FINDING_TIMEOUT_HOURS
}

/** True once the shop should call the customer (before the full timeout). */
export function findingNeedsCall(createdAt: string, now: number = Date.now()): boolean {
  return findingAgeHours(createdAt, now) >= FINDING_ADMIN_FLAG_HOURS
}
