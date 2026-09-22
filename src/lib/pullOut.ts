// pullOut.ts — server-side helpers for vehicle pull-out requests
// (paper: UC 15). Shared by the customer tracking route and the admin
// progress route so both read the request the same way.

import { db } from '@/lib/db'

export interface PullOutRequest {
  id: number
  reason: string | null
  decision: 'pending' | 'approved' | 'disputed' // disputed = denied
  adminNote: string | null
  createdAt: string
  decidedAt: string | null
}

/** The latest request on a job order (pending or decided), if any. */
export async function getLatestPullOut(jobOrderId: number): Promise<PullOutRequest | null> {
  const { rows } = await db.query(
    `SELECT id, reason, decision::text, admin_note, created_at::text, decided_at::text
     FROM pull_out_requests WHERE job_order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [jobOrderId],
  )
  const r = rows[0]
  if (!r) return null
  return { id: r.id, reason: r.reason, decision: r.decision, adminNote: r.admin_note, createdAt: r.created_at, decidedAt: r.decided_at }
}
