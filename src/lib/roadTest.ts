// lib/roadTest.ts — server-side reads for the Testing stage. Thin wrapper over
// get_road_test_history() so the admin and customer routes shape rows the
// same way. Writes go straight to start/pass/fail_road_test in the route.

import { db } from '@/lib/db'
import type { RoadTestAttempt } from '@/data/roadTest'

export async function getRoadTestHistory(jobOrderId: number): Promise<RoadTestAttempt[]> {
  const { rows } = await db.query(`SELECT * FROM get_road_test_history($1)`, [jobOrderId])
  return rows.map((r) => ({
    id: r.id,
    attemptNo: r.attempt_no,
    testerName: r.tester_name ?? 'Assigned Mechanic',
    startedAt: new Date(r.started_at).toISOString(),
    endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null,
    result: r.result ?? null,
    notes: r.notes ?? null,
    photoUrl: r.photo_url ?? null,
    reworkTaskIds: r.rework_task_ids ?? [],
    reworkTaskTitles: r.rework_task_titles ?? [],
    failedPartIds: r.failed_part_ids ?? [],
    failedPartNames: r.failed_part_names ?? [],
  }))
}

/** The attempt currently out on the road, if any. */
export function currentAttempt(history: RoadTestAttempt[]): RoadTestAttempt | null {
  return history.find((a) => a.endedAt === null) ?? null
}
