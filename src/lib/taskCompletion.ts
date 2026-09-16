// taskCompletion.ts — what happens to the JOB ORDER after one of its tasks is
// finished. Server-side only, called by the task-finish route.
//
//   1. Last service task done  -> create the Road Test task (business rule:
//      every car is driven before it goes back).
//   2. Every task done, road test included -> the job order is 'completed'.
//
// This used to be decided in the browser, which meant a job could be marked
// complete by whatever the page happened to think. Here it's one place, and
// the road test can't be skipped.

import { db } from '@/lib/db'
import { ROAD_TEST_TITLE, ROAD_TEST_NOTE } from '@/data/roadTest'

export async function afterTaskFinished(jobOrderId: number): Promise<{ roadTestCreated: boolean; jobCompleted: boolean }> {
  const { rows } = await db.query(
    `SELECT section_id::text AS section, task_title, task_status
     FROM service_progress_tasks
     WHERE job_order_id = $1`,
    [jobOrderId],
  )

  const serviceTasks = rows.filter((t) => t.section === 'in_progress')
  const hasRoadTest = rows.some((t) => t.task_title === ROAD_TEST_TITLE)
  const allServicesDone = serviceTasks.length > 0 && serviceTasks.every((t) => t.task_status === 'completed')

  let roadTestCreated = false
  if (allServicesDone && !hasRoadTest) {
    await db.query(
      `INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable)
       VALUES ($1, 'complete', $2, $3, 'pending', 0, false)`,
      [jobOrderId, ROAD_TEST_TITLE, ROAD_TEST_NOTE],
    )
    roadTestCreated = true
  }

  // Only completes once the road test exists AND is finished — a job with
  // all services done but no road test yet is still in progress.
  const allDone = hasRoadTest && rows.every((t) => t.task_status === 'completed')
  let jobCompleted = false
  if (allDone) {
    await db.query(`SELECT advance_job_order_stage($1, 'completed'::job_orders_status)`, [jobOrderId])
    jobCompleted = true
  }

  return { roadTestCreated, jobCompleted }
}
