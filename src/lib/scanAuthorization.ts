// scanAuthorization.ts — server-side helpers for mid-inspection OBD-II scan
// consent (see sql/Other/migration_add_scan_authorizations.sql). Shared by
// the admin inspection route and the customer inspecting-tracking route so
// both read the request the same way.

import { db } from '@/lib/db'

export interface ScanAuthorization {
  id: number
  adminNote: string | null
  decision: 'pending' | 'approved' | 'disputed' // disputed = declined
  requestedAt: string
  decidedAt: string | null
}

/**
 * The latest request on a job order (pending or decided), if any.
 * Returns null (instead of throwing) if the migration hasn't been run yet —
 * scan_authorizations is new, and this must not break the inspection page
 * for job orders loaded before it exists.
 */
export async function getLatestScanAuthorization(jobOrderId: number): Promise<ScanAuthorization | null> {
  try {
    const { rows } = await db.query(
      `SELECT id, admin_note, decision::text, requested_at::text, decided_at::text
       FROM scan_authorizations WHERE job_order_id = $1 ORDER BY requested_at DESC, id DESC LIMIT 1`,
      [jobOrderId],
    )
    const r = rows[0]
    if (!r) return null
    return { id: r.id, adminNote: r.admin_note, decision: r.decision, requestedAt: r.requested_at, decidedAt: r.decided_at }
  } catch (err) {
    if ((err as { code?: string })?.code === '42P01') return null // undefined_table
    throw err
  }
}
