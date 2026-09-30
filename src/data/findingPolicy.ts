// findingPolicy.ts — how long a customer has to answer a mid-service finding
// (paper: Use Case 14, Exception 1 — "fails to complete the 2FA verification
// loop for newly found additional services within 4 hours").
//
//   0 h      request sent (in-app + email)
//   30 min   one reminder to the customer
//   2 h      the shop is told to call the customer
//   4 h      final notice to the customer, and the request shows as
//            "Suspended. Awaiting Client Approval" until they answer.
//            (That label is worked out from the finding's age; there is no
//            "Suspended" job status. The holding fee and bay clearing from
//            the paper are documented limitations, not built.)

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
