// findings.ts — server-side helpers for mid-service findings (the
// service_findings table). Used by both the admin progress route and the
// customer tracking route so they read the rows the same way.

import { db } from '@/lib/db'
import type { ServiceFinding, ProposedService, ProposedPart } from '@/data/types'

export async function getFindingsForJobOrder(jobOrderId: number): Promise<ServiceFinding[]> {
  const { rows } = await db.query(
    `SELECT f.id, f.task_id, spt.task_title, e.full_name AS reported_by_name,
            f.findings, f.photo_url, f.proposed_services, f.proposed_parts,
            f.extra_cost, f.decision::text, f.decided_at::text, f.created_at::text
     FROM service_findings f
     LEFT JOIN service_progress_tasks spt ON spt.id = f.task_id
     LEFT JOIN employees e ON e.id = f.reported_by
     WHERE f.job_order_id = $1
     ORDER BY f.created_at DESC, f.id DESC`,
    [jobOrderId],
  )
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id ?? null,
    taskTitle: r.task_title ?? null,
    reportedByName: r.reported_by_name ?? null,
    findings: r.findings,
    photoUrl: r.photo_url ?? null,
    services: (r.proposed_services ?? []) as ProposedService[],
    parts: (r.proposed_parts ?? []) as ProposedPart[],
    extraCost: Number(r.extra_cost ?? 0),
    decision: r.decision,
    decidedAt: r.decided_at ?? null,
    createdAt: r.created_at,
  }))
}

// What the customer's approval adds up to. Kept in one place so the value
// saved on the finding and the value shown on screen can't drift apart.
export function findingTotal(services: ProposedService[], parts: ProposedPart[]): number {
  const labor = services.reduce((sum, s) => sum + Number(s.price || 0), 0)
  const partsCost = parts.reduce((sum, p) => sum + Number(p.unitPrice || 0) * Number(p.qty || 1), 0)
  return Math.round((labor + partsCost) * 100) / 100
}
