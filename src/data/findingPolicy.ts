// findingPolicy.ts — how long a customer has to answer a mid-service finding
// (paper: Use Case 14, Exception 1 — "fails to complete the 2FA verification
// loop for newly found additional services within 4 hours").
//
//   0 h   request sent (in-app + email)
//   2 h   one reminder — halfway, so it lands while they can still act
//   4 h   final notice to the customer, and the shop is told to call them
//         and roll the car to staging. (The "Suspended" job status and the
//         holding fee from the paper need schema from Jubert — not yet.)

export const FINDING_REMINDER_HOURS = 2
export const FINDING_TIMEOUT_HOURS = 4

/** Hours since the finding was sent, to one decimal. */
export function findingAgeHours(createdAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.round(((now - new Date(createdAt).getTime()) / 36e5) * 10) / 10)
}

export function findingIsOverdue(createdAt: string, now: number = Date.now()): boolean {
  return findingAgeHours(createdAt, now) >= FINDING_TIMEOUT_HOURS
}
